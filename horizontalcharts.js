/** 
 * For all details and documentation: {@link https://www.horizontalcharts.org|www.horizontalcharts.org}
 * @copyright Andrea Giovanni Bianchessi 2021
 * @author Andrea Giovanni Bianchessi <andrea.g.bianchessi@gmail.com>
 * @license MIT
 * @version 1.1.3
 *
 * @module HorizontalCharts
 */
; (function (exports) {
	'use strict';

	var Util = {
		merge: function () {
			arguments[0] = arguments[0] || {};
			for (var i = 1; i < arguments.length; i++) {
				for (var key in arguments[i]) {
					if (arguments[i].hasOwnProperty(key)) {
						if (typeof (arguments[i][key]) === 'object') {
							if (arguments[i][key] instanceof Array) {
								arguments[0][key] = arguments[i][key];
							} else {
								arguments[0][key] = Util.merge(arguments[0][key], arguments[i][key]);
							}
						} else {
							arguments[0][key] = arguments[i][key];
						}
					}
				}
			}
			return arguments[0];
		},
		resizeCanvas: function (canvas, factor) {
			var width = canvas.clientWidth;
			var height = canvas.height;
			canvas.width = 0 | (width * factor);
			canvas.height = 0 | (height * factor);
			canvas.style.height = height + 'px';
			canvas.getContext("2d").scale(factor, factor);
		}
	}

	/**
	 * Initialises a new <code>DataSample</code>.
	 *
	 * @constructor
	 * @param {Object} data - An object with <code>DataSample</code> data.
	 * @param {number} data.ts - This <code>DataSample</code> timestamp (milliseconds since the Unix Epoch). 
	 * @param {string} data.color - This <code>DataSample</code> color on the graph.
	 * @param {number} [data.value=NaN] - The value of this <code>DataSample</code>.
	 * @param {string} [data.desc=""] - A short text describing this <code>DataSample</code>.
	 * @memberof module:HorizontalCharts 
	*/
	function DataSample(data) {
		this.ts = typeof data.ts === 'number' ? data.ts : Number.NaN;
		this.color = typeof data.color === 'string' ? data.color : '#FF0000';
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
		barHeight: 22,
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
		var i = this.data.length - 1;
		while (i >= 0 && this.data[i].ts > dataSample.ts) {
			i--;
		}
		if (i === -1) {
			// This new item is the oldest data
			this.data.splice(0, 0, dataSample);
		} else if (this.data.length > 0 && this.data[i].ts === dataSample.ts) {
			// Replace existing values in the array
			if (this.options.replaceValue) {
				// Replace the previous sample
				this.data[i] = dataSample;
			}
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
	TimeSeries.prototype._dropOldData = function (canvasWidth) {
		var lengthSum = 0;
		for (var i = this.data.length - 1; i >= 0; i--) {
			if (isNaN(this.data[i].xEnd) || isNaN(this.data[i].xStart)) { console.log("NaN"); break; }
			lengthSum += this.data[i].xEnd - this.data[i].xStart;
			if (lengthSum > canvasWidth) {
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
	};

	/**
	   * @typedef {Object} DefaultChartOptions - Contains default chart options.
	 * @property {number} [overSampleFactor=3] - Canvas scaling factor.
	 * @property {string} [backgroundColor="#00000000"] - Background color (RGB[A] string) of the chart.
	 * @property {number} [padding=5] - Space between timeseries.
	 * @property {function} [formatTime] - Timestamp formatting function.
	 * @property {number} [axesWidth=2] - The thickness of the X and Y axes.
	 * @property {string} [axesColor="#000000"] - The color of the X and Y axes.
	 * @property {Object} [tooltip] - Tooltip options.
	 * @property {boolean} [tooltip.enabled=true] - If true tooltips are shown.
	 * @property {string} [tooltip.backgroundColor="#FFFFFFDD"] - Tooltips backround color.
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
		overSampleFactor: 3,
		backgroundColor: '#00000000',
		padding: 5,
		formatTime: function (ms) {
			function pad3(number) { if (number < 10) return '00' + number; if (number < 100) return '0' + number; return number; }
			var date = new Date(ms);
			var msStr = (pad3(ms - Math.floor(ms / 1000) * 1000) / 1000);
			return date.toLocaleString('en-US', { hour12: false }) + msStr;
		},
		axesWidth: 2,
		axesColor: '#000000',
		tooltip: {
			enabled: true,
			backgroundColor: '#FFFFFFDD'
		},
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
	 * Adds a <code>TimeSeries</code> to this chart.
	 * 
	 * @param {TimeSeries} timeSeries - The <code>TimeSeries</code> to add.
	 */
	HorizontalChart.prototype.addTimeSeries = function (timeSeries) {
		this.seriesSet.push(timeSeries);
	};

	/**
	 * Instructs the <code>HorizontalChart</code> to start rendering to the provided <code>Canvas</code>.
	 *
	 * @param {Canvas} canvas - The target canvas element.
	 */
	HorizontalChart.prototype.streamTo = function (canvas) {
		// DataSet check
		var valDataOk = this.seriesSet.every(s => s.data.every(
			(d, i, arr) => i == 0 ? true : isNaN(arr[i].value) === isNaN(arr[i - 1].value)
		));
		if (!valDataOk)
			throw new Error('Invalid DataSet!');
		// Render on Canvas
		this.canvas = canvas;
		this._render();
		// Add mouse listeners
		this.canvas.addEventListener('click', this._mouseclick.bind(this));
		this.canvas.addEventListener('mousemove', this._mousemove.bind(this));
		this.canvas.addEventListener('mouseout', this._mouseout.bind(this));
	};

	/**
	 * 
	 * @private
	 */
	HorizontalChart.prototype._render = function () {
		var xUnitsPerPixel = this.options.xAxis.xUnitsPerPixel;
		var xMax = this.options.xAxis.max;
		var nSeries = this.seriesSet.length;
		var ctx = this.canvas.getContext("2d");
		var canvasHeight = this.seriesSet.reduce(function (prevValue, currentSeries) {
			if (currentSeries.options.disabled) return prevValue;
			return prevValue + currentSeries.options.barHeight;
		}, 0);
		var seriesCount = this.seriesSet.reduce(function (prevValue, currentSeries) {
			if (currentSeries.options.disabled) return prevValue;
			return ++prevValue;
		}, 0);
		canvasHeight += (seriesCount + 1) * this.options.padding;
		//X Axis labels space
		var xLabelSpace = 0;
		if (typeof this.options.xAxis.xLabel === "string" && this.options.xAxis.xLabel.length > 0) {
			xLabelSpace = this.options.xAxis.fontSize + 5;
			canvasHeight += xLabelSpace;
		}

		this.canvas.style.height = canvasHeight + "px";
		this.canvas.height = canvasHeight;
		// Resize canvas
		Util.resizeCanvas(this.canvas, this.options.overSampleFactor);
		var canvasWidth = this.canvas.width;

		// Clear the working area.
		ctx.save();
		ctx.fillStyle = this.options.backgroundColor;
		ctx.clearRect(0, 0, canvasWidth, canvasHeight);
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);
		ctx.restore();

		// Compute y labels max width
		var labelsMaxWidth = 0;
		// For each data set...
		for (var d = 0; d < this.seriesSet.length; d++) {
			var timeSeries = this.seriesSet[d];
			if (timeSeries.options.disabled) {
				continue;
			}
			if (this.options.yLabels.enabled) {
				ctx.font = "bold " + this.options.yLabels.fontSize + 'px ' + this.options.yLabels.fontFamily;
				var labelString = timeSeries.options.labelText.length > 0
					? timeSeries.options.labelText
					: timeSeries.position;
				var textWidth = Math.ceil(ctx.measureText(labelString).width);
				if (textWidth > labelsMaxWidth) labelsMaxWidth = textWidth;
			}
		}
		if (labelsMaxWidth > 0) labelsMaxWidth += 4;

		//
		var xScale = (canvasWidth - (labelsMaxWidth + this.options.axesWidth) * this.options.overSampleFactor) / (this.options.overSampleFactor * xMax); // For isRealTime=false only

		//X Y Axis
		ctx.lineJoin = "round";
		ctx.lineWidth = this.options.axesWidth;
		ctx.strokeStyle = this.options.axesColor;
		ctx.moveTo(canvasWidth / this.options.overSampleFactor, this.canvas.clientHeight - xLabelSpace);
		ctx.lineTo(labelsMaxWidth, this.canvas.clientHeight - xLabelSpace);
		ctx.lineTo(labelsMaxWidth, 0);
		ctx.stroke();

		// X Axis label
		if (xLabelSpace > 0) {
			var labelText = this.options.xAxis.xLabel;
			var textWidth = Math.ceil(ctx.measureText(labelText).width);
			ctx.fillStyle = this.options.xAxis.fontColor;
			ctx.font = "bold " + this.options.xAxis.fontSize + 'px ' + this.options.xAxis.fontFamily;
			ctx.fillText(labelText,
				canvasWidth / (2 * this.options.overSampleFactor) - textWidth / 2,
				this.canvas.clientHeight - xLabelSpace / 2 + this.options.xAxis.fontSize / 2
			);
		}
		// Y Axis labels and bars, for each data set...
		for (var d = 0; d < this.seriesSet.length; d++) {
			var timeSeries = this.seriesSet[d];
			if (timeSeries.options.disabled) {
				continue;
			}
			ctx.fillStyle = this.options.yLabels.fontColor;
			ctx.font = "bold " + this.options.yLabels.fontSize + 'px ' + this.options.yLabels.fontFamily;
			var dataSet = timeSeries.data;
			var position = timeSeries.position;
			var barPaddedHeight = (canvasHeight - xLabelSpace) / nSeries;
			var yBarPosition = Math.round(barPaddedHeight * (position - 1) + this.options.padding / 2);
			var yCenteredPosition = Math.round(barPaddedHeight * (position - 1) + (barPaddedHeight / 2));
			// Draw y labels on the chart.
			if (this.options.yLabels.enabled) {
				var labelString = timeSeries.options.labelText.length > 0
					? timeSeries.options.labelText
					: timeSeries.position;
				// Label's text
				ctx.fillStyle = this.options.yLabels.fontColor;
				ctx.fillText(labelString, 0, yCenteredPosition);
			}

			// Draw bars
			var lastXend = 0, lineEnd = 0;
			for (var i = 0; i < dataSet.length; i++) {
				var value = dataSet[i].value;
				if (i === 0) {
					var lineStart = 0 + labelsMaxWidth + this.options.axesWidth;
					lineEnd = (value / xUnitsPerPixel) + labelsMaxWidth + this.options.axesWidth;
					if (!this.isRealTime) lineEnd = (value * xScale) + labelsMaxWidth + this.options.axesWidth;
					this._drawBar(yBarPosition, lineStart, lineEnd, dataSet[i], timeSeries.options);
				} else {
					var lineStart = lastXend;
					lineEnd = lineStart + (value / xUnitsPerPixel);
					if (!this.isRealTime) lineEnd = lineStart + (value * xScale);
					this._drawBar(yBarPosition, lineStart, lineEnd, dataSet[i], timeSeries.options);
				}
				lastXend = lineEnd;
			}
			// Delete old data that's moved off the left of the chart.
			if (dataSet.length > 1 && this.isRealTime)
				timeSeries._dropOldData(Math.floor(canvasWidth / this.options.overSampleFactor));
		}
		// Periodic render
		window.requestAnimationFrame((this._render.bind(this)));
	};

	/**
	 * 
	 * @private
	 */
	HorizontalChart.prototype._drawBar = function (y, xStart, xEnd, dataSample, tsOptions) {
		var ctx = this.canvas.getContext("2d");
		// Start - End
		dataSample.xStart = xStart;
		dataSample.xEnd = xEnd;
		//
		if (xEnd > this.canvas.width / this.options.overSampleFactor)
			return
		// bar
		var bar = new Path2D();
		ctx.fillStyle = dataSample.color;
		bar.rect(xStart, y, xEnd - xStart, tsOptions.barHeight);
		ctx.fill(bar);
		dataSample.path2D = bar;
		// Print value
		if (tsOptions.showValues && !isNaN(dataSample.value)) {
			var fontSize = (tsOptions.barHeight - 4 > 0 ? tsOptions.barHeight - 4 : 0);
			ctx.font = 'bold ' + fontSize + 'px ' + 'monospace';
			var valueString = Number(dataSample.value.toFixed(2)).toString();
			var textWidth = Math.ceil(ctx.measureText(valueString).width);
			if (textWidth < xEnd - xStart && fontSize > 0) {
				ctx.lineWidth = 1;
				ctx.fillStyle = "#FFFFFF";
				ctx.strokeStyle = 'black';
				ctx.fillText(valueString, Math.round(xStart + ((xEnd - xStart) / 2) - (textWidth / 2)), y + fontSize);
				ctx.strokeText(valueString, Math.round(xStart + ((xEnd - xStart) / 2) - (textWidth / 2)), y + fontSize);
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
		this.mouseover = true;
		this.mousePageX = evt.pageX;
		this.mousePageY = evt.pageY;
		if (!this.options.tooltip.enabled) {
			return;
		}
		var el = this._getTooltipEl();
		el.style.top = Math.round(this.mousePageY) + 'px';
		el.style.left = Math.round(this.mousePageX) + 'px';
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
			this.tooltipEl.className = 'horizontal-chart-tooltip';
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
		var el = this._getTooltipEl();
		if (!this.mouseover || !this.options.tooltip.enabled) {
			el.style.display = 'none';
			return;
		}
		var ctx = this.canvas.getContext("2d");
		var osf = this.options.overSampleFactor;
		var lines = [];
		for (var i = 0; i < this.seriesSet.length; i++) {
			var s = this.seriesSet[i];
			for (var j = 0; j < s.data.length; j++) {
				var d = s.data[j];
				if (d.path2D != null) {
					if (ctx.isPointInPath(d.path2D, evt.offsetX * osf, evt.offsetY * osf)) {
						var line = "";
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
