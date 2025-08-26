// Set the desired date for the yield curve (YYYY-MM-DD)
// You can change this date to view historical yield curves.
let targetDate = "2024-07-25"; // Example: Today's date

// Fetch the yield curve data
let url = `https://www.klickanalytics.com/api/v1/api.php?code=ycurve&curve_code=USDGS&date=${targetDate}`;
let req = new Request(url);
let res = await req.loadJSON();

// Extract the yield curve data
let curveData = res.results.curve_term_structure;

// Create the widget
let widget = new ListWidget();
widget.addText("U.S. Treasury Yield Curve").font = Font.boldSystemFont(16);

// Add each maturity period and yield to the widget
for (let point of curveData) {
  let text = `${point.maturity_period}: ${point.close_price}%`;
  widget.addText(text).font = Font.systemFont(14);
}

// Set the widget
Script.setWidget(widget);
Script.complete();
