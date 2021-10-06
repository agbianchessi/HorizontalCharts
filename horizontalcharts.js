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
	 * @param {number} x - The <code>DataSample</code> position on the abscissa axis. Use </code>NaN</code> to simply stack bars one afther the other. Timestamps are in milliseconds (number of milliseconds since the Unix Epoch). 
	 * @param {string} color - The <code>DataSample</code> color on the graph.
	 * @param {number} value - The value of this <code>DataSample</code>.
	 */
	function DataSample(x, color, value = Number.NaN) {
		this.x = typeof x === 'number' ? x : Number.NaN;
		this.color = typeof color === 'string' ? color : '#FF0000';
		this.value = typeof value === 'number' ? value : Number.NaN;
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
		barHeight: 20, //px
		minBarLength: 5,
		mergeIfSameColor: false, //TODO
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
	function HorizontalChart(options) {
		this.seriesSet = [];
		this.options = Util.extend({}, HorizontalChart.defaultChartOptions, options);
	};

	HorizontalChart.defaultChartOptions = {
		maxDataSetLength: 50,
		overSampleFactor: 2,
		backgroundColor: '#FFFFFF',
		padding: 5,
		yFormatter: function (y, precision) {
			return parseFloat(y).toFixed(precision);
		},
		tooltip: {
			enabled: true,
			backgroundColor: '#FFFFFF88'
		},
		xAxis: {
			xUnitsPerPixel: 10,
			isTime: false
		},
		xTicks: {
			enabled: true,
			color: '#555555'
		},
		labels: {
			enabled: true,
			fontSize: 12,
			fontFamily: 'monospace',
			fontColor: '#000000',
			backgroundColor: '#FFFFFF00'
		},
		colors: {
			go: '#00FF00',
			stop: '#FF0000',
			clear: '#FFFF00',
			off: '#000000'
		}
	};

	HorizontalChart.requestAnimationFrame = function (render) {
		window.requestAnimationFrame(render);
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
		this.canvas = canvas;
		Util.resizeCanvas(canvas, this.options.overSampleFactor);
		HorizontalChart.requestAnimationFrame((this.render.bind(this)));

		// Add mouse listeners
		this.canvas.addEventListener('click', this.mouseclick.bind(this));
		this.canvas.addEventListener('mousemove', this.mousemove.bind(this));
		this.canvas.addEventListener('mouseout', this.mouseout.bind(this));
	};

	/**
	 * Instructs the <code>HorizontalChart</code> to draw the chart on the provided <code>Canvas</code>.
	 *
	 * @param {Canvas} canvas - The target canvas element.
	 */
	HorizontalChart.prototype.drawOn = function (canvas) {
		this.canvas = canvas;
		this.render();

		// Add mouse listeners
		this.canvas.addEventListener('click', this.mouseclick.bind(this));
		this.canvas.addEventListener('mousemove', this.mousemove.bind(this));
		this.canvas.addEventListener('mouseout', this.mouseout.bind(this));
	};

	HorizontalChart.prototype.render = function () {
		var xUnitsPerPixel = this.options.xAxis.xUnitsPerPixel;
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
		var canvasWidth = this.canvas.width;

		this.canvas.style.height = canvasHeight + "px";
		this.canvas.height = canvasHeight;

		// Resize canvas
		Util.resizeCanvas(this.canvas, this.options.overSampleFactor);

		// Clear the working area.
		ctx.save();
		ctx.fillStyle = this.options.backgroundColor;
		ctx.clearRect(0, 0, canvasWidth, canvasHeight);
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);
		ctx.restore();

		// Compute y labels max width
		var labelsMaxWidth = 0;
		var LABEL_PADDING = 4;
		// For each data set...
		for (var d = 0; d < this.seriesSet.length; d++) {
			var timeSeries = this.seriesSet[d];
			if (timeSeries.options.disabled) {
				continue;
			}
			if (this.options.labels.enabled) {
				ctx.font = "bold " + this.options.labels.fontSize + 'px ' + this.options.labels.fontFamily;
				var labelString = timeSeries.options.labelText.length > 0
					? timeSeries.options.labelText
					: timeSeries.position;
				var textWidth = Math.ceil(ctx.measureText(labelString).width);
				if (textWidth > labelsMaxWidth) labelsMaxWidth = textWidth;
			}
		}

		// For each data set...
		for (var d = 0; d < this.seriesSet.length; d++) {
			var timeSeries = this.seriesSet[d];
			if (timeSeries.options.disabled) {
				continue;
			}
			var dataSet = timeSeries.data;
			var position = timeSeries.position;
			var barPaddedHeight = canvasHeight / nSeries;
			var yPosition = Math.round(
				(barPaddedHeight * (position - 1)) +
				(barPaddedHeight / 2)
			);

			// Draw y labels on the chart.
			if (this.options.labels.enabled) {
				ctx.font = "bold " + this.options.labels.fontSize + 'px ' + this.options.labels.fontFamily;
				var labelString = timeSeries.options.labelText.length > 0
					? timeSeries.options.labelText
					: timeSeries.position;
				var textWidth = Math.ceil(ctx.measureText(labelString).width);
				var textHeight = this.options.labels.fontSize;
				if (textWidth > labelsMaxWidth) labelsMaxWidth = textWidth;
				// Label's background
				ctx.fillStyle = this.options.labels.backgroundColor;
				ctx.fillRect(1, yPosition - textHeight + (LABEL_PADDING / 2), textWidth + LABEL_PADDING, textHeight + LABEL_PADDING);
				// Label's text
				ctx.fillStyle = this.options.labels.fontColor;
				ctx.fillText(labelString, 3, yPosition);
			}

			// Draw bars
			var firstX = 0, lastX = 0, lastXend = 0;
			for (var i = 0; i < dataSet.length && dataSet.length !== 1; i++) {
				var x = isNaN(dataSet[i].x) ? lastXend : dataSet[i].x;
				var value = dataSet[i].value;
				//set bar style.
				ctx.setLineDash([]); //TODO
				if (i === 0) {
					firstX = x;
					if (!isNaN(value)) {
						var lineStart = 0;
						var lineEnd = value / xUnitsPerPixel;
						this.drawBar(yPosition, lineStart, lineEnd, dataSet[i], timeSeries.options.barHeight, labelsMaxWidth);
					}
				} else {
					if (isNaN(dataSet[i - 1].value)) {
						var lineStart = Math.round((lastX - firstX) / xUnitsPerPixel);
						//if (lineStart < lastXend) lineStart = lastXend;
						var lineEnd = Math.round((x - firstX) / xUnitsPerPixel);
						this.drawBar(yPosition, lineStart, lineEnd, dataSet[i - 1], timeSeries.options.barHeight, labelsMaxWidth);
					}
					if (!isNaN(value)) {
						var lineStart = Math.round((x - firstX) / xUnitsPerPixel);
						if (lineStart < lastXend) lineStart = lastXend;
						if (isNaN(dataSet[i].x)) lineStart = lastXend;
						//var lineEnd = Math.round(((x - firstX) + value) / xUnitsPerPixel);
						var lineEnd = Math.round(lineStart + (value / xUnitsPerPixel));
						this.drawBar(yPosition, lineStart, lineEnd, dataSet[i], timeSeries.options.barHeight, labelsMaxWidth);
					}
				}

				// Delete old data that's moved off the left of the chart.
				var oldestValidX = Math.ceil(x - (canvasWidth * (xUnitsPerPixel / this.options.overSampleFactor)));
				timeSeries.dropOldData(oldestValidX, maxDataSetLength);

				lastX = x;
				lastXend = lineEnd;
			}
		}

		// Periodic render
		HorizontalChart.requestAnimationFrame((this.render.bind(this)));
	};

	HorizontalChart.prototype.drawBar = function (y, xStart, xEnd, dataSample, barHeight, labelsMaxWidth) {
		var ctx = this.canvas.getContext("2d");
		xStart += labelsMaxWidth * this.options.overSampleFactor;
		xEnd += labelsMaxWidth * this.options.overSampleFactor;
		//vertical ticks
		ctx.lineWidth = 1;
		ctx.strokeStyle = this.options.xTicks.color;
		ctx.beginPath();
		ctx.moveTo(xEnd, this.canvas.clientHeight - 3);
		ctx.lineTo(xEnd, this.canvas.clientHeight);
		ctx.stroke();
		//bar
		var bar = new Path2D();
		ctx.lineWidth = barHeight;
		ctx.strokeStyle = dataSample.color;
		ctx.beginPath();
		bar.moveTo(xStart, y);
		bar.lineTo(xEnd, y);
		ctx.stroke(bar);
		dataSample.path2D = bar;
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
		this.seriesSet.forEach(function (s, index) {
			s.data.forEach(function (d, index) {
				if (d.path2D != null)
					if (ctx.isPointInStroke(d.path2D, evt.offsetX * osf, evt.offsetY * osf)) {
						var line = "<span><b>X:</b> " + d.x; //TODO formattare se timestamp xAxis.isTime
						lines.push(line);
						line = "<span><b>Value:</b> " + d.value;
						lines.push(line);
					}
			});
		});

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
