/** 
 * For all details and documentation: {@link https://www.horizontalcharts.org|www.horizontalcharts.org}
 * @copyright Andrea Giovanni Bianchessi 2023
 * @author Andrea Giovanni Bianchessi <andrea.g.bianchessi@gmail.com>
 * @license MIT
 * @version 1.2.6
 *
 * @module HorizontalCharts
 */
; (function (exports) {
	'use strict';

	const Util = {
		merge: function (target, ...objs) {
			target = target ?? {};
			for (let i = 0; i < objs.length; i++) {
				for (let key in objs[i]) {
					if (Object.hasOwn(objs[i], key)) {
						if (typeof (objs[i][key]) === 'object') {
							if (objs[i][key] instanceof Array) {
								target[key] = objs[i][key].slice(); //shallow copy
							} else {
								target[key] = Util.merge(target[key], objs[i][key]);
							}
						} else {
							target[key] = objs[i][key];
						}
					}
				}
			}
			return target;
		},
		resizeCanvas: function (canvas, factor, horizontal) {
			const width = horizontal ? canvas.clientWidth : canvas.width;
			const height = horizontal ? canvas.height : canvas.clientHeight;
			canvas.width = 0 | (width * factor);
			canvas.height = 0 | (height * factor);
			if (horizontal)
				canvas.style.height = height + 'px';
			else
				canvas.style.width = width + 'px';
			canvas.getContext("2d").scale(factor, factor);
		},
		getTextLineHeight: function (ctx, fontSize, fontFamily) {
			ctx.save();
			ctx.font = fontSize + 'px ' + fontFamily;
			const metrics = ctx.measureText('AgB');
			const fontHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
			ctx.restore();
			return fontHeight;
		}
	}

	/**
	 * Initialises a new <code>DataSample</code>.
	 *
	 * @constructor
	 * @param {Object} data - An object with <code>DataSample</code> data.
	 * @param {number} data.ts - This <code>DataSample</code> timestamp (milliseconds since the Unix Epoch). 
	 * @param {string|CanvasPattern} data.color - The color or pattern of this <code>DataSample</code>.
	 * @param {number} [data.borderWidth=1] - The border width of this <code>DataSample</code>. 0 = no border line.
	 * @param {string} [data.borderColor="black"] - The border color of this <code>DataSample</code>.
	 * @param {number} [data.value=NaN] - The value of this <code>DataSample</code>.
	 * @param {string} [data.desc=""] - A short text describing this <code>DataSample</code>.
	 * @memberof module:HorizontalCharts 
	*/
	function DataSample(data) {
		this.ts = typeof data.ts === 'number' ? data.ts : Number.NaN;
		this.color = data.color;
		this.borderWidth = typeof data.borderWidth === 'number' ? data.borderWidth : 1;
		this.borderColor = typeof data.borderColor === 'string' ? data.borderColor : 'black';
		this.value = typeof data.value === 'number' ? data.value : Number.NaN;
		this.desc = typeof data.desc === 'string' ? data.desc : '';
		this.xStart = Number.NaN;
		this.xEnd = Number.NaN;
		this.path2D = null;
	}

	/**
	* Initialises a new <code>TimeSeries</code> with optional data options.
	*
	* @constructor
	* @param {number} position - Unique, integer and strictly positive value, it sorts series on the graph from top to bottom.
	* @param {DefaultTimeSeriesOptions} [options] - <code>TimeSeries</code> options.
	* @memberof module:HorizontalCharts
	*/
	function TimeSeries(position, options) {
		this.position = position;
		this.options = Util.merge({}, TimeSeries.defaultTimeSeriesOptions, options);
		this.clear();
	};

	/**
	 * @typedef {Object} DefaultTimeSeriesOptions - Contains default chart options.
	 * @property {number} [barHeight=22] - The thickness of the bars.
	 * @property {boolean} [showValues=true] - Enables the printing of data samples values inside bars.
	 * @property {string} [labelText=""] - A short text describing this <code>TimeSeries</code>.
	 * @property {boolean} [replaceValue=false] - If data sample <code>ts</code> has an exact match in the series, this flag controls whether it is replaced, or not.
	 * @property {boolean} [disabled=false] - This flag controls wheter this timeseries is displayed or not.
	 */
	TimeSeries.defaultTimeSeriesOptions = {
		barHeight: 25,
		showValues: true,
		labelText: "",
		replaceValue: false,
		disabled: false
	};

	/**
	 * Clears all data from this <code>TimeSeries</code>.
	 */
	TimeSeries.prototype.clear = function () {
		this.data = [];
	};

	/**
	 * Adds a new data sample to the <code>TimeSeries</code>, preserving chronological order.
	 *
	 * @param {DataSample} dataSample - The <code>DataSample</code> to add.
	 */
	TimeSeries.prototype.append = function (dataSample) {
		if (isNaN(dataSample.ts)) {
			// Add to the end of the array
			this.data.push(dataSample);
			return;
		}
		// Rewind until we hit an older x
		let i = this.data.length - 1;
		while (i >= 0 && this.data[i].ts > dataSample.ts) {
			i--;
		}
		if (i === -1) {
			// This new item is the oldest data
			this.data.splice(0, 0, dataSample);
		} else if (this.data.length > 0 && this.data[i].ts === dataSample.ts) {
			// Replace existing values in the array
			if (this.options.replaceValue)
				this.data[i] = dataSample;
		} else {
			//insert
			if (i < this.data.length - 1) {
				// Splice into the correct position to keep the ts's in order
				this.data.splice(i + 1, 0, dataSample);
			} else {
				// Add to the end of the array
				this.data.push(dataSample);
			}
		}
	};

	/**
	 * 
	 * @private
	 */
	TimeSeries.prototype._dropOldData = function (chartXlength) {
		let lengthSum = 0;
		for (let i = this.data.length - 1; i >= 0; i--) {
			if (isNaN(this.data[i].xEnd) || isNaN(this.data[i].xStart))
				break
			lengthSum += this.data[i].xEnd - this.data[i].xStart;
			if (lengthSum > chartXlength) {
				this.data.splice(0, i + 1);
				break;
			}
		}
	};

	/**
	 * Initialises a new <code>HorizontalChart</code>.
	 *
	 * @constructor
	 * @param {DefaultChartOptions} [options] - <code>HorizontalChart</code> options.
	 * @param {boolean} [isRealTime=false] - Enables the real-time data visualization mode.
	 * @memberof module:HorizontalCharts
	 */
	function HorizontalChart(options, isRealTime = false) {
		this.seriesSet = [];
		this.isRealTime = isRealTime;
		this.options = Util.merge({}, HorizontalChart.defaultChartOptions, options);
		this._overSampleFactor = 0;
	};

	/**
	 * @typedef {Object} DefaultChartOptions - Contains default chart options.
	 * @property {number} [customOverSampleFactor=0] - User-defined Canvas scaling factor. 0 = not used.
	 * @property {string} [backgroundColor="#00000000"] - Background color (RGB[A] string) of the chart.
	 * @property {number} [padding=5] - Space between timeseries.
	 * @property {number} [horizontal=true] - If false chart is 90° rotated counterclockwise.
	 * @property {function} [formatTime] - Timestamp formatting function.
	 * @property {number} [axesWidth=2] - The thickness of the X and Y axes.
	 * @property {string} [axesColor="#000000"] - The color of the X and Y axes.
	 * @property {Object} [grid] - Grid options.
	 * @property {Object} [grid.y] - Y grid axis options.
	 * @property {boolean} [grid.y.enabled=false] - If true Y grid axis are shown.
	 * @property {string} [grid.y.color="#000000"] - Y grid axis color.
	 * @property {Object} [grid.x] - X grid axis options.
	 * @property {boolean} [grid.x.enabled=false] - If true X grid axis are shown.
	 * @property {number} [grid.x.stepSize=20] - X grid axis step size.
	 * @property {string} [grid.x.color="#000000"] - X grid axis color. 
	 * @property {boolean} [grid.x.showLabels=false] - If true X grid labels are shown.
	 * @property {number} [grid.x.fontSize=10] - Font size of the X grid labels.
	 * @property {string} [grid.x.fontFamily="monospace"] - Font family of the X grid labels.
	 * @property {Object} [tooltip] - Tooltip options.
	 * @property {boolean} [tooltip.enabled=true] - If true tooltips are shown.
	 * @property {string} [tooltip.backgroundColor="#FFFFFFDD"] - Tooltips backround color.
	 * @property {number} [minBarLength=0] - Minimum bar length.
	 * @property {Object} [xAxis] - X axis options.
	 * @property {number} [xAxis.xUnitsPerPixel=10] - X axis scaling factor.
	 * @property {number} [xAxis.max=105] - On real time charts this is the maximum value on the X axis. On non real time charts it is ignored.
	 * @property {string} [xAxis.xLabel=""] - X axis title.
	 * @property {number} [xAxis.fontSize=12] - Font size of the X axis title.
	 * @property {string} [xAxis.fontFamily="monospace"] - Font family of the X axis title.
	 * @property {string} [xAxis.fontColor="#000000"] - Font color of the X axis title.
	 * @property {Object} [yLabels] - Y labels options.
	 * @property {boolean} [yLabels.enabled=true] - If true Y labels are shown.
	 * @property {boolean} [yLabels.fontSize=12] - Font size of the Y labels.
	 * @property {string} [yLabels.fontFamily="monospace"] - Font family of the Y labels.
	 * @property {string} [yLabels.fontColor="#000000"] - Font color of the Y labels.
	 * 
	 */
	HorizontalChart.defaultChartOptions = {
		customOverSampleFactor: 0,
		backgroundColor: '#00000000',
		padding: 5,
		horizontal: true,
		formatTime: function (ms) {
			const date = new Date(ms);
			return date.toLocaleString('en-US', { hour12: false }) + "." + date.getMilliseconds();
		},
		axesWidth: 2,
		axesColor: '#000000',
		grid: {
			y: {
				enabled: false,
				color: '#000000'
			},
			x: {
				enabled: false,
				stepSize: 20,
				color: '#000000',
				showLabels: false,
				fontSize: 10,
				fontFamily: 'monospace'
			}
		},
		tooltip: {
			enabled: true,
			backgroundColor: '#FFFFFFDD'
		},
		minBarLength: 0,
		xAxis: {
			xUnitsPerPixel: 10,
			max: 105,
			xLabel: "",
			fontSize: 12,
			fontFamily: 'monospace',
			fontColor: '#000000'
		},
		yLabels: {
			enabled: true,
			fontSize: 12,
			fontFamily: 'monospace',
			fontColor: '#000000'
		}
	};

	/**
	 * Adds <code>TimeSeries</code> to this chart.
	 * 
	 * @param {...TimeSeries} timeSeries - The <code>TimeSeries</code> to add.
	 */
	HorizontalChart.prototype.addTimeSeries = function (...timeSeries) {
		this.seriesSet.push(...timeSeries);
	};

	/**
	 * Instructs the <code>HorizontalChart</code> to start rendering to the provided <code>Canvas</code>.
	 *
	 * @param {Canvas} canvas - The target canvas element.
	 */
	HorizontalChart.prototype.streamTo = function (canvas) {
		// DataSet validation
		this._datasetValidation(this.seriesSet);
		// Render on Canvas
		this.canvas = canvas;
		window.requestAnimationFrame((this._render.bind(this)));
		// Add mouse listeners
		this.canvas.addEventListener('click', this._mouseclick.bind(this));
		this.canvas.addEventListener('mousemove', this._mousemove.bind(this));
		this.canvas.addEventListener('mouseout', this._mouseout.bind(this));
	};

	/**
	 * 
	 * @private
	 */
	HorizontalChart.prototype._datasetValidation = function (seriesSet) {
		const valDataOk = seriesSet.every(s => s.data.every(
			(d, i, arr) => i == 0 ? true : isNaN(arr[i].value) === isNaN(arr[i - 1].value)
		));
		if (!valDataOk)
			throw new Error('Invalid DataSet!');
		return valDataOk;
	}

	/**
	 * 
	 * @private
	 */
	HorizontalChart.prototype._render = function (tFrame) {
		const xUnitsPerPixel = this.options.xAxis.xUnitsPerPixel;
		const xMax = this.options.xAxis.max;
		const ctx = this.canvas.getContext("2d");
		const seriesCount = this.seriesSet.reduce(function (prevValue, currentSeries) {
			if (currentSeries.options.disabled)
				return prevValue;
			return ++prevValue;
		}, 0);
		//Canvas heigth
		let chartYLength = this.seriesSet.reduce(function (prevValue, currentSeries) {
			if (currentSeries.options.disabled)
				return prevValue;
			return prevValue + currentSeries.options.barHeight;
		}, 0);
		chartYLength += (seriesCount + 1) * this.options.padding;
		//X axis width
		chartYLength += this.options.axesWidth;
		//X Axis labels space
		let xLabelSpace = 0;
		if (typeof this.options.xAxis.xLabel === "string" && this.options.xAxis.xLabel.length > 0) {
			xLabelSpace = Util.getTextLineHeight(ctx, this.options.xAxis.fontSize, this.options.xAxis.fontFamily) + 4;
			chartYLength += xLabelSpace;
		}
		//X Axis ticks space
		let xTicksSpace = 0;
		if(this.options.grid.x.showLabels){
			xTicksSpace = Util.getTextLineHeight(ctx, this.options.grid.x.fontSize, this.options.grid.x.fontFamily) + 4;
			chartYLength += xTicksSpace;
		}
		// X Axis labels space + X Axis ticks space
		const xTicksLabelSpace = xLabelSpace + xTicksSpace;
		// Resize canvas
		if (this.options.horizontal) {
			this.canvas.style.height = chartYLength + "px";
			this.canvas.height = chartYLength;
		} else {
			this.canvas.style.width = chartYLength + "px";
			this.canvas.width = chartYLength;
		}
		if (this.options.customOverSampleFactor > 0)
			this._overSampleFactor = this.options.customOverSampleFactor;
		else if (typeof exports.devicePixelRatio == 'undefined')
			this._overSampleFactor = 3;
		else
			this._overSampleFactor = exports.devicePixelRatio;
		Util.resizeCanvas(this.canvas, this._overSampleFactor, this.options.horizontal);
		const chartXlength = this.options.horizontal ? this.canvas.width : this.canvas.height;
		// Clear the working area.
		ctx.fillStyle = this.options.backgroundColor;
		ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
		ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
		//90° counterclockwise rotatation
		if (!this.options.horizontal) {
			ctx.translate(0, chartXlength / this._overSampleFactor);
			ctx.rotate(-90 * Math.PI / 180);
		}
		// Compute y labels max width
		let labelsMaxWidth = 0;
		// For each data set...
		for (const timeSeries of this.seriesSet) {
			if (timeSeries.options.disabled)
				continue;
			if (this.options.yLabels.enabled) {
				ctx.font = "bold " + this.options.yLabels.fontSize + 'px ' + this.options.yLabels.fontFamily;
				const labelString = timeSeries.options.labelText.length > 0
					? timeSeries.options.labelText
					: timeSeries.position;
				const textWidth = Math.ceil(ctx.measureText(labelString).width);
				if (textWidth > labelsMaxWidth)
					labelsMaxWidth = textWidth;
			}
		}
		if (labelsMaxWidth > 0)
			labelsMaxWidth += 4;
		// Scale factor for non real-time charts
		const xScale = (chartXlength - (labelsMaxWidth + this.options.axesWidth) * this._overSampleFactor) / (this._overSampleFactor * xMax);
		// X Y Axis
		ctx.lineJoin = "round";
		ctx.lineWidth = this.options.axesWidth;
		ctx.strokeStyle = this.options.axesColor;
		ctx.beginPath();
		ctx.moveTo(chartXlength / this._overSampleFactor, chartYLength - (ctx.lineWidth / 2) - xTicksLabelSpace);
		ctx.lineTo(labelsMaxWidth, chartYLength - (ctx.lineWidth / 2) - xTicksLabelSpace);
		ctx.lineTo(labelsMaxWidth, 0);
		ctx.stroke();
		// X grid
		if (this.options.grid.x.enabled) {
			let xPos = this.options.grid.x.stepSize;
			ctx.lineWidth = 1;
			ctx.strokeStyle = this.options.grid.x.color;
			let tickCounter = 0;
			while (xMax - xPos > 0) {
				tickCounter++;
				ctx.beginPath();
				ctx.moveTo((xPos * xScale) + labelsMaxWidth + this.options.axesWidth, chartYLength - xTicksLabelSpace - this.options.axesWidth);
				ctx.lineTo((xPos * xScale) + labelsMaxWidth + this.options.axesWidth, 0);
				ctx.stroke();
				//Ticks text
				const tickText = (tickCounter*this.options.grid.x.stepSize).toString();
				ctx.fillStyle = this.options.xAxis.fontColor;
				ctx.font = this.options.grid.x.fontSize + 'px ' + this.options.grid.x.fontFamily;
				const textWidth = Math.ceil(ctx.measureText(tickText).width);
				ctx.fillText(tickText, 
					(xPos * xScale) + labelsMaxWidth + this.options.axesWidth - (textWidth/2), 
					chartYLength - xTicksLabelSpace + (xTicksSpace / 2)
				);
				//
				xPos += this.options.grid.x.stepSize;
			}
		}
		// X Axis label
		if (xLabelSpace > 0) {
			const labelText = this.options.xAxis.xLabel;
			const textWidth = Math.ceil(ctx.measureText(labelText).width);
			ctx.fillStyle = this.options.xAxis.fontColor;
			ctx.font = "bold " + this.options.xAxis.fontSize + 'px ' + this.options.xAxis.fontFamily;
			ctx.fillText(labelText,
				chartXlength / (2 * this._overSampleFactor) - textWidth / 2,
				chartYLength - (xLabelSpace / 2)
			);
		}
		// Y Axis labels and bars, for each data set...
		for (const timeSeries of this.seriesSet) {
			if (timeSeries.options.disabled)
				continue;
			const dataSet = timeSeries.data;
			const position = timeSeries.position;
			const barPaddedHeight = (chartYLength - this.options.axesWidth - xTicksLabelSpace) / seriesCount;
			const yBarPosition = (barPaddedHeight * (position - 1) + this.options.padding / 2);
			const yCenteredPosition = barPaddedHeight * (position - 1) + (barPaddedHeight / 2);
			// Draw y labels on the chart.
			if (this.options.yLabels.enabled) {
				const labelString = timeSeries.options.labelText.length > 0
					? timeSeries.options.labelText
					: timeSeries.position;
				// Label's text
				ctx.fillStyle = this.options.yLabels.fontColor;
				ctx.font = "bold " + this.options.yLabels.fontSize + 'px ' + this.options.yLabels.fontFamily;
				ctx.fillText(labelString, 0, yCenteredPosition);
			}
			// Y grid
			if (this.options.grid.y.enabled && position > 1) {
				ctx.lineWidth = 1;
				ctx.strokeStyle = this.options.grid.y.color;
				ctx.beginPath();
				ctx.moveTo(labelsMaxWidth, yBarPosition - this.options.padding / 2);
				ctx.lineTo(chartXlength / this._overSampleFactor, yBarPosition - this.options.padding / 2);
				ctx.stroke();
			}
			// Draw bars
			let lastXend = 0, lineStart = 0, lineEnd = 0;
			for (let i = 0; i < dataSet.length; i++) {
				const value = dataSet[i].value;
				if (i === 0) {
					lineStart = 0 + labelsMaxWidth + this.options.axesWidth;
					lineEnd = (value / xUnitsPerPixel) + labelsMaxWidth + this.options.axesWidth;
					if (!this.isRealTime)
						lineEnd = (value * xScale) + labelsMaxWidth + this.options.axesWidth;
					if (this.options.minBarLength > 0 && (lineEnd - lineStart) < this.options.minBarLength)
						lineEnd = lineStart + this.options.minBarLength
				} else {
					lineStart = lastXend;
					lineEnd = lineStart + (value / xUnitsPerPixel);
					if (!this.isRealTime)
						lineEnd = lineStart + (value * xScale);
					if (this.options.minBarLength > 0 && (lineEnd - lineStart) < this.options.minBarLength)
						lineEnd = lineStart + this.options.minBarLength
				}
				this._drawBar(yBarPosition, lineStart, lineEnd, dataSet[i], timeSeries.options);
				lastXend = lineEnd;
			}
			// Delete old data that's moved off the left of the chart.
			if (dataSet.length > 1 && this.isRealTime)
				timeSeries._dropOldData(Math.floor(chartXlength / this._overSampleFactor));
		}
		// Periodic render
		window.requestAnimationFrame((this._render.bind(this)));
	};

	/**
	 * 
	 * @private
	 */
	HorizontalChart.prototype._drawBar = function (y, xStart, xEnd, dataSample, tsOptions) {
		const ctx = this.canvas.getContext("2d");
		// Start - End
		dataSample.xStart = xStart;
		dataSample.xEnd = xEnd;
		dataSample.y = y;
		//
		if (this.options.horizontal && xEnd > this.canvas.width / this._overSampleFactor)
			return;
		if (!this.options.horizontal && xEnd > this.canvas.height / this._overSampleFactor)
			return;
		// bar
		ctx.save();
		//fill
		let bar = new Path2D();
		ctx.translate(xStart, y); // Aligns the bar starting point to the pattern starting point
		bar.rect(0, 0, xEnd - xStart, tsOptions.barHeight);
		ctx.fillStyle = dataSample.color;
		ctx.fill(bar);
		//border
		let barBorder = new Path2D();
		ctx.lineWidth = dataSample.borderWidth > 0 ? dataSample.borderWidth : 1;
		ctx.strokeStyle = dataSample.borderWidth > 0 ? dataSample.borderColor : dataSample.color;
		barBorder.rect(0, 0, xEnd - xStart, tsOptions.barHeight);
		ctx.stroke(barBorder);
		//
		dataSample.path2D = bar;
		ctx.restore();
		// Print value
		if (tsOptions.showValues && !isNaN(dataSample.value)) {
			const fontSize = (tsOptions.barHeight - 4 > 0 ? tsOptions.barHeight - 4 : 0);
			ctx.font = 'bold ' + fontSize + 'px ' + 'monospace';
			const valueString = Number(dataSample.value.toFixed(2)).toString();
			const textWidth = Math.ceil(ctx.measureText(valueString).width);
			if (textWidth < xEnd - xStart && fontSize > 0) {
				ctx.lineWidth = 1;
				ctx.fillStyle = "#FFFFFF";
				ctx.strokeStyle = 'black';
				ctx.fillText(valueString, 
					xStart + ((xEnd - xStart) / 2) - (textWidth / 2), 
					y + tsOptions.barHeight/2 + Util.getTextLineHeight(ctx, fontSize, 'monospace')/4
				);
				ctx.strokeText(valueString, 
					xStart + ((xEnd - xStart) / 2) - (textWidth / 2), 
					y + tsOptions.barHeight/2 + Util.getTextLineHeight(ctx, fontSize, 'monospace')/4
				);
			}
		}
	}

	/**
	 * Mouse click event callback function.
	 * 
	 * @param {Object} evt - The mouse click event.
	 * @private
	 */
	HorizontalChart.prototype._mouseclick = function (evt) {
		return;
	};

	/**
	 * Mouse move event callback function.
	 * 
	 * @param {Object} evt - The mouse move event.
	 * @private
	 */
	HorizontalChart.prototype._mousemove = function (evt) {
		const cursor_offset = 16 / this._overSampleFactor;
		this.mouseover = true;
		if (!this.options.tooltip.enabled)
			return;
		let el = this._getTooltipEl();
		el.style.top = (cursor_offset + evt.pageY) + 'px';
		el.style.left = (cursor_offset + evt.pageX) + 'px';
		this._updateTooltip(evt);
	};

	/**
	 * Mouse out event callback function.
	 * 
	 * @param {Object} evt - The mouse out event.
	 * @private
	 */
	HorizontalChart.prototype._mouseout = function () {
		this.mouseover = false;
		if (this.tooltipEl)
			this.tooltipEl.style.display = 'none';
	};

	/**
	 * Retrieve the tooltip element.
	 * 
	 * @returns The tooltip element.
	 * @private
	 */
	HorizontalChart.prototype._getTooltipEl = function () {
		if (!this.tooltipEl) {
			this.tooltipEl = document.createElement('div');
			this.tooltipEl.className = 'horizontalcharts-tooltip';
			this.tooltipEl.style.backgroundColor = this.options.tooltip.backgroundColor;
			this.tooltipEl.style.border = '0.06em solid black';
			this.tooltipEl.style.pointerEvents = 'none';
			this.tooltipEl.style.position = 'absolute';
			this.tooltipEl.style.display = 'none';
			document.body.appendChild(this.tooltipEl);
		}
		return this.tooltipEl;
	};

	/**
	 * Update the tooltip content.
	 * 
	 * @param {Object} evt - The mouse event.
	 * @private
	 */
	HorizontalChart.prototype._updateTooltip = function (evt) {
		let el = this._getTooltipEl();
		if (!this.mouseover || !this.options.tooltip.enabled) {
			el.style.display = 'none';
			return;
		}
		const isPointInPath = (d, x, y, h) => {
			const osf = this._overSampleFactor;
			const ctx = this.canvas.getContext("2d");
			if (h)
				return ctx.isPointInPath(d.path2D, (x - d.xStart) * osf, (y - d.y) * osf);
			else {
				y = y - (this.canvas.height / osf);
				x = x ^ y;
				y = y ^ x;
				x = x ^ y;
				x = -x;
				return ctx.isPointInPath(d.path2D, (y - d.y) * osf, this.canvas.height - (x - d.xStart) * osf);
			}
		};
		let lines = [];
		for (const s of this.seriesSet) {
			for (const d of s.data) {
				if (d.path2D != null) {
					if (isPointInPath(d, evt.offsetX, evt.offsetY, this.options.horizontal)) {
						let line = "";
						if (d.desc.length > 0) {
							line = "<span><b>" + d.desc + "</b></span>";
							lines.push(line);
						}
						if (!isNaN(d.ts)) {
							line = "<span><b>Time:</b> " + this.options.formatTime(d.ts) + "</span>";
							lines.push(line);
						}
						if (!isNaN(d.value)) {
							line = "<span><b>Value:</b> " + Number(d.value.toFixed(2)) + "</span>";
							lines.push(line);
						}
					}
				}
			}
		}
		if (lines.length > 0) {
			el.innerHTML = lines.join('<br>');
			el.style.display = 'block';
		} else {
			el.innerHTML = "";
			el.style.display = 'none';
		}
	};

	exports.DataSample = DataSample;
	exports.TimeSeries = TimeSeries;
	exports.HorizontalChart = HorizontalChart;

})(typeof exports === 'undefined' ? this : exports);
