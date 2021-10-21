# HorizontalCharts
*HorizontalCharts* is a small JavaScript charting library with built-in live streaming feature.

![chart](https://user-images.githubusercontent.com/5993480/138280570-0c7d3c0f-7671-4ae1-b5d4-fa89e587165e.png)

---

### Example
Include the *HorizontalCharts* library:

```html
<script src="horizontalcharts.js"></script>
```

Given a `<canvas>`:

```html
<canvas id="chart" style="width:100%;"></canvas>
```
Create time series and chart with code resembling:

```js
// Create time series
var ts1 = new TimeSeries(1, {labelText: "Day 1"});
var ts2 = new TimeSeries(2, {labelText: "Day 2"});
var ts3 = new TimeSeries(3, {labelText: "Day 3"});

// Add data to time series
ts1.data = [
  new DataSample({color:'#FF0000', value: 20, desc:"Bob"}),
  new DataSample({color:'#BB0000', value: 30, desc:"John"}),
  new DataSample({color:'#880000', value: 10, desc:"Max"}),
  new DataSample({color:'#330000', value: 40, desc:"Ann"})
  ];
ts2.data = [
  new DataSample({color:'#0000FF', value: 10, desc:"Bob"}),
  new DataSample({color:'#0000BB', value: 50, desc:"John"}),
  new DataSample({color:'#000088', value: 20, desc:"Max"}),
  new DataSample({color:'#000033', value: 20, desc:"Ann"})
  ];
ts3.data = [
  new DataSample({color:'#00FF00', value: 10, desc:"Bob"}),
  new DataSample({color:'#00BB00', value: 40, desc:"John"}),
  new DataSample({color:'#008800', value: 15, desc:"Ann"})
  ];
  
// Find the canvas
var canvas = document.getElementById('chart');
  
// Create the chart
var options = {xAxis: {xLabel:"Percentage of completion"}};
var chart = new HorizontalChart(options);
chart.addTimeSeries(ts1);
chart.addTimeSeries(ts2);
chart.addTimeSeries(ts3);
chart.streamTo(canvas);
```
