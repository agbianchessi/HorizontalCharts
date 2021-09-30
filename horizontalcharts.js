; (function (exports) {

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
	 * 
	 * @param {*} timestamp 
	 * @param {*} color 
	 * @param {*} value 
	 * @constructor
	 */
	function DataSample(timestamp, color, value = Number.NaN) {
		this.ts = typeof timestamp === 'number' ? timestamp : Number.NaN;
		this.color = typeof color === 'string' ? color : '#FF0000';
		this.value = typeof value === 'number' ? value : Number.NaN;
	}

	/**
	* Initialises a new <code>TimeSeries</code> with optional data options.
	*
	* @param position unique, integer and strictly positive value, it sorts series on the graph from top to bottom
	* @param options optional <code>TimeSeries</code> options
	* @constructor
	*/
	function TimeSeries(position, options) {
		this.position = position;
		this.options = Util.extend({}, TimeSeries.defaultOptions, options);
		this.clear();
	};

	TimeSeries.defaultOptions = {
		lineWidth: 20, //px
		lineDashPattern: [5, 5], //TODO
		minBarLength: 5,
		labelText: "",
		replaceValue: false, //if <code>timestamp</code> has an exact match in the series, this flag controls whether it is replaced, or not (defaults to false)
		disabled: false //this flag controls wheter this timeseries is displayed or not
	};

	/**
	 * Clears all data from this TimeSeries object.
	 */
	TimeSeries.prototype.clear = function () {
		this.data = []; //each record is a tuple: (timestamp, value, color)
	};

	/**
	 * Adds a new data point to the <code>TimeSeries</code>, preserving chronological order.
	 *
	 * @param dataSample
	 */
	TimeSeries.prototype.append = function (dataSample) {
		// Rewind until we hit an older timestamp
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
				// Splice into the correct position to keep timestamps in order
				this.data.splice(i + 1, 0, dataSample);
			} else {
				// Add to the end of the array
				this.data.push(dataSample);
			}
		}
	};

	TimeSeries.prototype.dropOldData = function (oldestValidTime, maxDataSetLength) {
		// We must always keep one expired data point as we need this to draw the
		// line that comes into the chart from the left, but any points prior to that can be removed.
		var removeCount = 0;
		while (this.data.length - removeCount >= maxDataSetLength || this.data[removeCount + 1].ts < oldestValidTime) {
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
	 */
	function HorizontalChart(options) {
		this.seriesSet = [];
		this.options = Util.extend({}, HorizontalChart.defaultChartOptions, options);
	};

	HorizontalChart.defaultChartOptions = {
		millisPerPixel: 50, //TODO
		maxDataSetLength: 50,
		overSampleFactor: 2,
		backgroundColor: '#FFFFFF',
		padding: 5,
		labels: {
			enabled: true,
			fontSize: 12,
			fontFamily: 'monospace',
			fontColor: '#000000',
			backgroundColor: '#FFFFFF'
		},
		colors: {
			go: '#00FF00',
			stop: '#FF0000',
			clear: '#FFFF00',
			off: '#000000'
		}
	};

	/**
	 * Adds a <code>TimeSeries</code> to this chart.
	 */
	HorizontalChart.prototype.addTimeSeries = function (timeSeries, options) {
		this.seriesSet.push(timeSeries);
	};

	/**
	 * Instructs the <code>HorizontalChart</code> to start rendering to the provided canvas.
	 *
	 * @param canvas the target canvas element
	 */
	HorizontalChart.prototype.streamTo = function (canvas) {
		this.canvas = canvas;
		Util.resizeCanvas(canvas, this.options.overSampleFactor);
		this.render(true);
	};

	/**
	 * Instructs the <code>HorizontalChart</code> to draw the chart on the provided canvas.
	 *
	 * @param canvas the target canvas element
	 */
	HorizontalChart.prototype.drawOn = function (canvas) {
		this.canvas = canvas;
		this.render(false);
	};

	HorizontalChart.prototype.render = function (streaming) {
		var millisPerPixel = this.options.millisPerPixel;
		var maxDataSetLength = this.options.maxDataSetLength;
		var nSeries = this.seriesSet.length;
		var ctx = this.canvas.getContext("2d");
		var canvasHeight = this.seriesSet.reduce(function (prevValue, currentSeries) {
			if (currentSeries.options.disabled) return prevValue;
			return prevValue + currentSeries.options.lineWidth;
		}, 0);
		var seriesCount = this.seriesSet.reduce(function (prevValue, currentSeries) {
			if (currentSeries.options.disabled) return prevValue;
			return ++prevValue;
		}, 0);
		canvasHeight += (seriesCount + 1) * this.options.padding;

		this.canvas.style.height = canvasHeight + "px";
		this.canvas.height = canvasHeight;
		var dimensions = { top: 0, left: 0, width: this.canvas.width, height: canvasHeight };

		// Resize canvas
		Util.resizeCanvas(this.canvas, this.options.overSampleFactor);

		// Clear the working area.
		ctx.save();
		ctx.fillStyle = this.options.backgroundColor;
		ctx.clearRect(0, 0, dimensions.width, dimensions.height);
		ctx.fillRect(0, 0, dimensions.width, dimensions.height);
		ctx.restore();

		// For each data set...
		for (var d = 0; d < this.seriesSet.length; d++) {
			var timeSeries = this.seriesSet[d];
			if (timeSeries.options.disabled) {
				continue;
			}
			var dataSet = timeSeries.data;
			var position = timeSeries.position;
			var barPaddedHeight = dimensions.height / nSeries; //TODO rename
			var yPosition = Math.round(
				(barPaddedHeight * (position - 1)) +
				(barPaddedHeight / 2)
			);
			// Set style for this dataSet.
			ctx.lineWidth = timeSeries.options.lineWidth;
			var firstX = 0, lastX = 0;
			for (var i = 0; i < dataSet.length && dataSet.length !== 1; i++) {
				var x = dataSet[i].ts;
				var value = dataSet[i].value;
				//set bar style.
				ctx.setLineDash([]); //TODO
				if (i === 0) {
					firstX = x;
					if (!isNaN(value)) {
						var lineStart = 0;
						var lineEnd = value / millisPerPixel;
						ctx.beginPath();
						ctx.moveTo(lineStart, yPosition);
						ctx.lineTo(lineEnd, yPosition);
						ctx.stroke();
						ctx.closePath();
					}
				} else {
					if (isNaN(dataSet[i - 1].value)) {
						var lineStart = Math.round((lastX - firstX) / millisPerPixel);
						var lineEnd = Math.round((x - firstX) / millisPerPixel);
						ctx.strokeStyle = dataSet[i - 1].color;
						ctx.beginPath();
						ctx.moveTo(lineStart, yPosition);
						ctx.lineTo(lineEnd, yPosition);
						ctx.stroke();
						ctx.closePath();
					}
					if (!isNaN(value)) {
						var lineStart = Math.round((x - firstX) / millisPerPixel);
						var lineEnd = Math.round(((x - firstX) + value) / millisPerPixel);
						ctx.strokeStyle = dataSet[i].color;
						ctx.beginPath();
						ctx.moveTo(lineStart, yPosition);
						ctx.lineTo(lineEnd, yPosition);
						ctx.stroke();
						ctx.closePath();
					}
				}

				// Delete old data that's moved off the left of the chart.
				var oldestValidTime = Math.ceil(x - (dimensions.width * (millisPerPixel / this.options.overSampleFactor)));
				timeSeries.dropOldData(oldestValidTime, maxDataSetLength);

				lastX = x;
			}

			// Draw y labels on the chart.
			if (this.options.labels.enabled) {
				ctx.font = "bold " + this.options.labels.fontSize + 'px ' + this.options.labels.fontFamily;
				var labelString = timeSeries.options.labelText.length > 0
					? timeSeries.options.labelText
					: timeSeries.position;
				var textWidth = Math.ceil(ctx.measureText(labelString).width);
				var textHeight = this.options.labels.fontSize;
				// Label's background
				ctx.fillStyle = this.options.labels.backgroundColor;
				ctx.fillRect(1, yPosition - textHeight + 2, textWidth + 4, textHeight + 4);
				// Label's text
				ctx.fillStyle = this.options.labels.fontColor;
				ctx.fillText(labelString, 3, yPosition);
			}

		}

		// Periodic render
		this.periodicRender = streaming ?
			setTimeout(
				function (graph) {
					graph.render(streaming);
				}, 1000, this)
			:
			null;
	};

	exports.DataSample = DataSample;
	exports.TimeSeries = TimeSeries;
	exports.HorizontalChart = HorizontalChart;

})(typeof exports === 'undefined' ? this : exports);
