/**
 * (c) 2021 Andrea Giovanni Bianchessi
 * MIT Licensed
 * For all details and documentation:
 * https://github.com/agbianchessi/HorizontalCharts
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
	 * @param {number} data.ts - This <code>DataSample</code> Timestamp (milliseconds since the Unix Epoch). 
	 * @param {string} data.color - The <code>DataSample</code> color on the graph.
	 * @param {number} data.value - Optional parameter. The value of this <code>DataSample</code>.
	 * @param {string} data.desc - Optional parameter. A text describing this <code>DataSample</code>, it will be shown in the tooltip.
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
	* @param {Object} options - Optional <code>TimeSeries</code> options.
	*/
	function TimeSeries(position, options) {
		this.position = position;
		this.options = Util.merge({}, TimeSeries.defaultOptions, options);
		this.clear();
	};

	TimeSeries.defaultOptions = {
		barHeight: 22,
		showValues: true,
		minBarLength: 5,
		labelText: "",
		replaceValue: false, //if <code>x</code> has an exact match in the series, this flag controls whether it is replaced, or not (defaults to false)
		disabled: false //this flag controls wheter this timeseries is displayed or not
	};

	/**
	 * Clears all data from this <code>TimeSeries</code> object.
	 */
	TimeSeries.prototype.clear = function () {
		this.data = [];
	};

	/**
	 * Adds a new data point to the <code>TimeSeries</code>, preserving chronological order.
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

	TimeSeries.prototype.dropOldData = function (canvasWidth) {
		var offset = canvasWidth * 0.1;
		var lengthSum = 0;
		for (var i = this.data.length - 1; i > 0; i--) {
			if (isNaN(this.data[i].xEnd) || isNaN(this.data[i].xStart)) break;
			lengthSum += this.data[i].xEnd - this.data[i].xStart;
			if (lengthSum > canvasWidth - offset) {
				this.data.splice(0, i + 1);
				break;
			}
		}
	};

	/**
	 * Initialises a new <code>HorizontalChart</code>.
	 *
	 * @constructor
	 * @param {Object} options - Optional <code>HorizontalChart</code> options.
	 */
	function HorizontalChart(options, isRealTime = false) {
		this.seriesSet = [];
		this.isRealTime = isRealTime;
		this.options = Util.merge({}, HorizontalChart.defaultChartOptions, options);
	};

	HorizontalChart.defaultChartOptions = {
		maxDataSetLength: 50,
		overSampleFactor: 3,
		backgroundColor: '#00000000',
		padding: 5,
		formatTime: function (ms) {
			function pad3(number) { if (number < 10) return '00' + number; if (number < 100) return '0' + number; return number; }
			var date = new Date(ms);
			var msStr = (pad3(ms - Math.floor(ms / 1000) * 1000) / 1000);
			return date.toLocaleString('en-US', { hour12: false }) + msStr;
		},
		axisWidth: 2,
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
			fontColor: '#000000',
			color: '#000000'
		},
		yLabels: {
			enabled: true,
			fontSize: 12,
			fontFamily: 'monospace',
			fontColor: '#000000',
			backgroundColor: '#FFFFFF00'
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
		this.render();
		// Add mouse listeners
		this.canvas.addEventListener('click', this.mouseclick.bind(this));
		this.canvas.addEventListener('mousemove', this.mousemove.bind(this));
		this.canvas.addEventListener('mouseout', this.mouseout.bind(this));
	};

	HorizontalChart.prototype.render = function () {
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
		var xScale = (canvasWidth - (labelsMaxWidth + this.options.axisWidth) * this.options.overSampleFactor) / (this.options.overSampleFactor * xMax); // For isRealTime=false only

		//X Y Axis
		ctx.lineJoin = "round";
		ctx.lineWidth = this.options.axisWidth;
		ctx.strokeStyle = this.options.xAxis.color;
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
			var firstX = 0, lastX = 0, lastXend = 0, lineEnd = 0;
			for (var i = 0; i < dataSet.length; i++) {
				var x = lastXend;
				var value = dataSet[i].value;
				if (i === 0) {
					firstX = x;
					var lineStart = 0 + labelsMaxWidth + this.options.axisWidth;
					lineEnd = (value / xUnitsPerPixel) + labelsMaxWidth + this.options.axisWidth;
					if (!this.isRealTime) lineEnd = (value * xScale) + labelsMaxWidth + this.options.axisWidth;
					this.drawBar(yBarPosition, lineStart, lineEnd, dataSet[i], timeSeries.options);
				} else {
					var lineStart = lastXend;
					lineEnd = lineStart + (value / xUnitsPerPixel);
					if (!this.isRealTime) lineEnd = lineStart + (value * xScale);
					this.drawBar(yBarPosition, lineStart, lineEnd, dataSet[i], timeSeries.options);
				}

				// Delete old data that's moved off the left of the chart.
				if (dataSet.length > 1 && this.isRealTime)
					timeSeries.dropOldData(Math.floor(canvasWidth / this.options.overSampleFactor));
				lastX = x;
				lastXend = lineEnd;
			}
		}
		// Periodic render
		window.requestAnimationFrame((this.render.bind(this)));
	};

	HorizontalChart.prototype.drawBar = function (y, xStart, xEnd, dataSample, tsOptions) {
		var ctx = this.canvas.getContext("2d");
		// Start - End
		dataSample.xStart = xStart;
		dataSample.xEnd = xEnd;
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

	HorizontalChart.prototype.mouseclick = function (evt) {
		return;
	};

	HorizontalChart.prototype.mousemove = function (evt) {
		this.mouseover = true;
		this.mousePageX = evt.pageX;
		this.mousePageY = evt.pageY;
		if (!this.options.tooltip.enabled) {
			return;
		}
		var el = this.getTooltipEl();
		el.style.top = Math.round(this.mousePageY) + 'px';
		el.style.left = Math.round(this.mousePageX) + 'px';
		this.updateTooltip(evt);
	};

	HorizontalChart.prototype.mouseout = function () {
		this.mouseover = false;
		if (this.tooltipEl)
			this.tooltipEl.style.display = 'none';
	};

	HorizontalChart.prototype.getTooltipEl = function () {
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

	HorizontalChart.prototype.updateTooltip = function (evt) {
		var el = this.getTooltipEl();
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
