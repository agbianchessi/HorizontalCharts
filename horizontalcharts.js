/**
 * (c) 2021 Andrea Giovanni Bianchessi
 * MIT Licensed
 * For all details and documentation:
 * https://github.com/agbianchessi/HorizontalCharts
 */

; (function (exports) {
	'use strict';

	var Util = {
		extend: function () {
			arguments[0] = arguments[0] || {};
			for (var i = 1; i < arguments.length; i++) {
				for (var key in arguments[i]) {
					if (arguments[i].hasOwnProperty(key)) {
						if (typeof (arguments[i][key]) === 'object') {
							if (arguments[i][key] instanceof Array) {
								arguments[0][key] = arguments[i][key];
							} else {
								arguments[0][key] = Util.extend(arguments[0][key], arguments[i][key]);
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
	 * @param {number} data.x - The <code>DataSample</code> position on the abscissa axis. Use </code>NaN</code> to simply stack bars one afther the other. Timestamps are in milliseconds (number of milliseconds since the Unix Epoch). 
	 * @param {string} data.color - The <code>DataSample</code> color on the graph.
	 * @param {number} data.value - Optional parameter. The value of this <code>DataSample</code>.
	 */
	function DataSample(data) {
		this.x = typeof data.x === 'number' ? data.x : Number.NaN;
		this.color = typeof data.color === 'string' ? data.color : '#FF0000';
		this.value = typeof data.value === 'number' ? data.value : Number.NaN;
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
		this.options = Util.extend({}, TimeSeries.defaultOptions, options);
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
		if (isNaN(dataSample.x)) {
			// Add to the end of the array
			this.data.push(dataSample);
			return;
		}
		// Rewind until we hit an older x
		var i = this.data.length - 1;
		while (i >= 0 && this.data[i].x > dataSample.x) {
			i--;
		}
		if (i === -1) {
			// This new item is the oldest data
			this.data.splice(0, 0, dataSample);
		} else if (this.data.length > 0 && this.data[i].x === dataSample.x) {
			// Replace existing values in the array
			if (this.options.replaceValue) {
				// Replace the previous sample
				this.data[i] = dataSample;
			}
		} else {
			//insert
			if (i < this.data.length - 1) {
				// Splice into the correct position to keep the x's in order
				this.data.splice(i + 1, 0, dataSample);
			} else {
				// Add to the end of the array
				this.data.push(dataSample);
			}
		}
	};

	TimeSeries.prototype.dropOldData = function (oldestValidX, maxDataSetLength) {
		// We must always keep one expired data point as we need this to draw the
		// line that comes into the chart from the left, but any points prior to that can be removed.
		var removeCount = 0;
		while (this.data.length - removeCount >= maxDataSetLength || this.data[removeCount + 1].x < oldestValidX) {
			removeCount++;
		}
		if (removeCount !== 0) {
			this.data.splice(0, removeCount);
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
		this.isRealTime = isRealTime;  //TODO scalare su tutta la lunghezza del canvas se non è realtime
		this.options = Util.extend({}, HorizontalChart.defaultChartOptions, options);
	};

	HorizontalChart.defaultChartOptions = {
		maxDataSetLength: 50,
		overSampleFactor: 3,
		backgroundColor: '#00000000',
		padding: 5,
		formatTime: function (ms) {
			function pad2(number) { return (number < 10 ? '0' : '') + number }
			function pad3(number) { if (number < 10) return '00' + number; if (number < 100) return '0' + number; return number; }
			var date = new Date(ms);
			var msStr = (pad3(ms - Math.floor(ms / 1000) * 1000) / 1000);
			return date.toLocaleString('en-US', { hour12: false }) + msStr;
		},
		tooltip: {
			enabled: true,
			backgroundColor: '#FFFFFFDD'
		},
		xAxis: {
			xUnitsPerPixel: 10,
			min: 0,
			max: 110,
			isTime: true,
			ticksEnabled: true,
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
		var xDataOk = this.seriesSet.every(s => s.data.every(
			(d, i, arr) => i == 0 ? true : isNaN(arr[i].x) === isNaN(arr[i - 1].x)
		));
		var valDataOk = this.seriesSet.every(s => s.data.every(
			(d, i, arr) => i == 0 ? true : isNaN(arr[i].value) === isNaN(arr[i - 1].value)
		));
		if (!xDataOk || !valDataOk)
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
		var xMin = this.options.xAxis.min;
		var xMax = this.options.xAxis.max;
		var maxDataSetLength = this.options.maxDataSetLength;
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
		var xScale = canvasWidth / (this.options.overSampleFactor * xMax); // For isRealTime=false only

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

		//X Y Axis
		ctx.lineJoin = "round";
		ctx.lineWidth = 2;
		ctx.strokeStyle = this.options.xAxis.color;
		ctx.moveTo(canvasWidth / this.options.overSampleFactor, this.canvas.clientHeight - xLabelSpace);
		ctx.lineTo(labelsMaxWidth * this.options.overSampleFactor - 2, this.canvas.clientHeight - xLabelSpace);
		ctx.lineTo(labelsMaxWidth * this.options.overSampleFactor - 2, 0);
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
				var textWidth = Math.ceil(ctx.measureText(labelString).width);
				var textHeight = this.options.yLabels.fontSize;
				if (textWidth > labelsMaxWidth) labelsMaxWidth = textWidth;
				// Label's text
				ctx.fillStyle = this.options.yLabels.fontColor;
				ctx.fillText(labelString, 3, yCenteredPosition);
			}

			// Draw bars
			var firstX = 0, lastX = 0, lastXend = 0;
			for (var i = 0; i < dataSet.length; i++) {
				var x = isNaN(dataSet[i].x) ? lastXend : dataSet[i].x;
				var value = dataSet[i].value;
				if (i === 0) {
					firstX = x;
					if (!isNaN(value)) {
						var lineStart = 0 + labelsMaxWidth * this.options.overSampleFactor;
						var lineEnd = value / xUnitsPerPixel + labelsMaxWidth * this.options.overSampleFactor;
						if (!this.isRealTime) lineEnd = Math.round(value * xScale) + labelsMaxWidth * this.options.overSampleFactor;
						this.drawBar(yBarPosition, yCenteredPosition, lineStart, lineEnd, dataSet[i], timeSeries.options);
					}
				} else {
					if (dataSet.length !== 1 && isNaN(dataSet[i - 1].value)) {
						var lineStart = Math.round((lastX - firstX) / xUnitsPerPixel) + labelsMaxWidth * this.options.overSampleFactor;
						if (!this.isRealTime) lineStart = Math.round((lastX - firstX) * xScale);
						//if (lineStart < lastXend) lineStart = lastXend;
						var lineEnd = Math.round((x - firstX) / xUnitsPerPixel) + labelsMaxWidth * this.options.overSampleFactor;
						if (!this.isRealTime) lineEnd = Math.round((x - firstX) * xScale) + labelsMaxWidth * this.options.overSampleFactor;
						this.drawBar(yBarPosition, yCenteredPosition, lineStart, lineEnd, dataSet[i - 1], timeSeries.options);
					}
					if (!isNaN(value)) {
						var lineStart = Math.round((x - firstX) / xUnitsPerPixel) + labelsMaxWidth * this.options.overSampleFactor;
						if (!this.isRealTime) lineStart = Math.round((x - firstX) * xScale);
						if (lineStart < lastXend) lineStart = lastXend;
						if (isNaN(dataSet[i].x)) lineStart = lastXend;
						//var lineEnd = Math.round(((x - firstX) + value) / xUnitsPerPixel);
						var lineEnd = Math.round(lineStart + (value / xUnitsPerPixel)) + labelsMaxWidth * this.options.overSampleFactor;
						if (!this.isRealTime) lineEnd = Math.round(lineStart + (value * xScale)) + labelsMaxWidth * this.options.overSampleFactor;
						this.drawBar(yBarPosition, yCenteredPosition, lineStart, lineEnd, dataSet[i], timeSeries.options);
					}
				}

				// Delete old data that's moved off the left of the chart.
				if (dataSet.length !== 1) {
					var oldestValidX = Math.ceil(x - (canvasWidth * (xUnitsPerPixel / this.options.overSampleFactor)));
					timeSeries.dropOldData(oldestValidX, maxDataSetLength);
				}
				lastX = x;
				lastXend = lineEnd;
			}
		}
		// Periodic render
		window.requestAnimationFrame((this.render.bind(this)));
	};

	HorizontalChart.prototype.drawBar = function (y, yCentered, xStart, xEnd, dataSample, tsOptions) {
		var ctx = this.canvas.getContext("2d");
		//bar
		var bar = new Path2D();
		ctx.fillStyle = dataSample.color;
		bar.rect(xStart, y, xEnd - xStart, tsOptions.barHeight);
		ctx.fill(bar);
		dataSample.path2D = bar;
		//Print value
		if (tsOptions.showValues && !isNaN(dataSample.value)) {
			var fontSize = (tsOptions.barHeight - 4 > 0 ? tsOptions.barHeight - 4 : 0);
			ctx.font = 'bold ' + fontSize + 'px ' + 'monospace';
			var valueString = dataSample.value + "jyMTèg";
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
						var line = "<span><b>X:</b> " + (this.options.xAxis.isTime ? this.options.formatTime(d.x) : d.x);
						lines.push(line);
						line = "<span><b>Value:</b> " + d.value;
						lines.push(line);
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
