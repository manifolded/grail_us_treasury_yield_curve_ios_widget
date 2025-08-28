
// US Treasury Yield Curve Widget for Scriptable
// Displays today's Treasury yield curve as a line chart
// Data sourced from the US Department of Treasury XML feed

// Configuration
const WIDGET_SIZE = { width: 350, height: 150 };
const CHART_PADDING = { top: 25, right: 20, bottom: 35, left: 40 };
const CHART_SIZE = {
  width: WIDGET_SIZE.width - CHART_PADDING.left - CHART_PADDING.right,
  height: WIDGET_SIZE.height - CHART_PADDING.top - CHART_PADDING.bottom
};

// Get current year for API call
const currentYear = new Date().getFullYear();

// Cache configuration
const CACHE_DURATION_HOURS = 12; // Cache data for 12 hours
const CACHE_FILE_NAME = "treasury_yield_cache.json";
const USE_ICLOUD_STORAGE = false; // Set to false to use local storage instead

// Cache management functions
function getFileManager() {
  return USE_ICLOUD_STORAGE ? FileManager.iCloud() : FileManager.local();
}

function getCacheFilePath() {
  const fm = getFileManager();
  return fm.joinPath(fm.documentsDirectory(), CACHE_FILE_NAME);
}

async function getCachedData() {
  try {
    const fm = getFileManager();
    const cachePath = getCacheFilePath();
    
    if (!fm.fileExists(cachePath)) {
      return null;
    }
    
    const cacheString = fm.readString(cachePath);
    const cacheData = JSON.parse(cacheString);
    
    // Check if cache is still valid
    const cacheAge = Date.now() - cacheData.timestamp;
    const cacheAgeHours = cacheAge / (1000 * 60 * 60);
    
    if (cacheAgeHours < CACHE_DURATION_HOURS) {
      console.log(`Using cached data (${cacheAgeHours.toFixed(1)} hours old)`);
      // Add cache metadata to the result
      const result = { ...cacheData.data };
      result.cacheStatus = `Cached ${cacheAgeHours.toFixed(1)}h ago`;
      result.fromCache = true;
      return result;
    } else {
      console.log(`Cache expired (${cacheAgeHours.toFixed(1)} hours old), will fetch new data`);
      return null;
    }
  } catch (error) {
    console.error("Error reading cache:", error);
    return null;
  }
}

async function setCachedData(data) {
  try {
    const fm = getFileManager();
    const cachePath = getCacheFilePath();
    
    const cacheObject = {
      timestamp: Date.now(),
      data: data
    };
    
    const cacheString = JSON.stringify(cacheObject);
    fm.writeString(cachePath, cacheString);
    console.log("Data cached successfully");
  } catch (error) {
    console.error("Error writing cache:", error);
  }
}

// Fetch Treasury yield curve data
async function fetchYieldData() {
  // First try to get cached data
  const cachedData = await getCachedData();
  if (cachedData) {
    return cachedData;
  }
  
  // If no valid cache, fetch from API
  try {
    console.log("Fetching fresh data from Treasury API...");
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${currentYear}`;
    const req = new Request(url);
    const xmlString = await req.loadString();
    
    // Parse XML manually since Scriptable doesn't have full XML parser
    const entries = xmlString.match(/<entry[^>]*>[\s\S]*?<\/entry>/g);
    if (!entries || entries.length === 0) {
      throw new Error("No data entries found");
    }
    
    // Get the most recent entry (last in the array)
    const latestEntry = entries[entries.length - 1];
    
    // Extract date
    const dateMatch = latestEntry.match(/<d:NEW_DATE[^>]*>(.*?)<\/d:NEW_DATE>/);
    const date = dateMatch ? dateMatch[1] : "Unknown";
    
    // Define maturities and their XML field names
    const maturities = [
      { label: "1M", field: "BC_1MONTH", months: 1 },
      { label: "2M", field: "BC_2MONTH", months: 2 },
      { label: "3M", field: "BC_3MONTH", months: 3 },
      { label: "4M", field: "BC_4MONTH", months: 4 },
      { label: "6M", field: "BC_6MONTH", months: 6 },
      { label: "1Y", field: "BC_1YEAR", months: 12 },
      { label: "2Y", field: "BC_2YEAR", months: 24 },
      { label: "3Y", field: "BC_3YEAR", months: 36 },
      { label: "5Y", field: "BC_5YEAR", months: 60 },
      { label: "7Y", field: "BC_7YEAR", months: 84 },
      { label: "10Y", field: "BC_10YEAR", months: 120 },
      { label: "20Y", field: "BC_20YEAR", months: 240 },
      { label: "30Y", field: "BC_30YEAR", months: 360 }
    ];
    
    const yieldData = [];
    for (const maturity of maturities) {
      const regex = new RegExp(`<d:${maturity.field}[^>]*>(.*?)<\/d:${maturity.field}>`, 'i');
      const match = latestEntry.match(regex);
      if (match && match[1] && match[1].trim() !== "" && match[1] !== "N/A") {
        const yield = parseFloat(match[1]);
        if (!isNaN(yield)) {
          yieldData.push({
            label: maturity.label,
            months: maturity.months,
            yield: yield
          });
        }
      }
    }
    
    const result = { date, yieldData };
    result.cacheStatus = "Fresh data";
    result.fromCache = false;
    
    // Cache the successful result
    await setCachedData(result);
    
    return result;
  } catch (error) {
    console.error("Error fetching yield data:", error);
    
    // If API fails, try to return any cached data even if expired as fallback
    const expiredCache = await getFallbackCachedData();
    if (expiredCache) {
      console.log("Using expired cached data as fallback");
      return expiredCache;
    }
    
    return null;
  }
}

// Get cached data even if expired (for fallback purposes)
async function getFallbackCachedData() {
  try {
    const fm = getFileManager();
    const cachePath = getCacheFilePath();
    
    if (!fm.fileExists(cachePath)) {
      return null;
    }
    
    const cacheString = fm.readString(cachePath);
    const cacheData = JSON.parse(cacheString);
    
    const cacheAge = Date.now() - cacheData.timestamp;
    const cacheAgeHours = cacheAge / (1000 * 60 * 60);
    
    console.log("Returning expired cache as fallback");
    const result = { ...cacheData.data };
    result.cacheStatus = `Expired cache (${cacheAgeHours.toFixed(1)}h old)`;
    result.fromCache = true;
    return result;
  } catch (error) {
    console.error("Error reading fallback cache:", error);
    return null;
  }
}

// Clear cache (for debugging/manual refresh)
async function clearCache() {
  try {
    const fm = getFileManager();
    const cachePath = getCacheFilePath();
    
    if (fm.fileExists(cachePath)) {
      fm.remove(cachePath);
      console.log("Cache cleared successfully");
      return true;
    } else {
      console.log("No cache file to clear");
      return false;
    }
  } catch (error) {
    console.error("Error clearing cache:", error);
    return false;
  }
}

// Get cache info (for debugging)
async function getCacheInfo() {
  try {
    const fm = getFileManager();
    const cachePath = getCacheFilePath();
    
    if (!fm.fileExists(cachePath)) {
      return { exists: false };
    }
    
    const cacheString = fm.readString(cachePath);
    const cacheData = JSON.parse(cacheString);
    const cacheAge = Date.now() - cacheData.timestamp;
    const cacheAgeHours = cacheAge / (1000 * 60 * 60);
    
    return {
      exists: true,
      ageHours: cacheAgeHours,
      isValid: cacheAgeHours < CACHE_DURATION_HOURS,
      timestamp: new Date(cacheData.timestamp).toISOString(),
      dataDate: cacheData.data.date
    };
  } catch (error) {
    console.error("Error getting cache info:", error);
    return { exists: false, error: error.message };
  }
}

// Create yield curve chart
function createYieldCurveChart(yieldData, date, cacheStatus = null) {
  const drawContext = new DrawContext();
  drawContext.size = new Size(WIDGET_SIZE.width, WIDGET_SIZE.height);
  drawContext.opaque = false;
  drawContext.respectScreenScale = true;
  
  // Background
  const bgRect = new Rect(0, 0, WIDGET_SIZE.width, WIDGET_SIZE.height);
  drawContext.setFillColor(new Color("#1c1c1e"));
  drawContext.fillRect(bgRect);
  
  if (!yieldData || yieldData.length === 0) {
    // Error message
    drawContext.setFont(Font.systemFont(14));
    drawContext.setTextColor(Color.red());
    drawContext.drawTextInRect("No yield data available", new Rect(10, 60, WIDGET_SIZE.width - 20, 30));
    return drawContext.getImage();
  }
  
  // Find min and max yields for scaling
  const yields = yieldData.map(d => d.yield);
  const minYield = Math.min(...yields);
  const maxYield = Math.max(...yields);
  const yieldRange = maxYield - minYield;
  const yPadding = yieldRange * 0.1; // 10% padding
  const yMin = Math.max(0, minYield - yPadding);
  const yMax = maxYield + yPadding;
  const adjustedYieldRange = yMax - yMin;
  
  // Chart area
  const chartRect = new Rect(
    CHART_PADDING.left,
    CHART_PADDING.top,
    CHART_SIZE.width,
    CHART_SIZE.height
  );
  
  // Draw grid lines
  drawContext.setStrokeColor(new Color("#333333"));
  drawContext.setLineWidth(0.5);
  
  // Horizontal grid lines (yield levels)
  for (let i = 0; i <= 4; i++) {
    const y = chartRect.y + (i / 4) * chartRect.height;
    const path = new Path();
    path.move(new Point(chartRect.x, y));
    path.addLine(new Point(chartRect.x + chartRect.width, y));
    drawContext.addPath(path);
    drawContext.strokePath();
  }
  
  // Draw axes
  drawContext.setStrokeColor(new Color("#666666"));
  drawContext.setLineWidth(1);
  
  // Y-axis
  const yAxisPath = new Path();
  yAxisPath.move(new Point(chartRect.x, chartRect.y));
  yAxisPath.addLine(new Point(chartRect.x, chartRect.y + chartRect.height));
  drawContext.addPath(yAxisPath);
  drawContext.strokePath();
  
  // X-axis
  const xAxisPath = new Path();
  xAxisPath.move(new Point(chartRect.x, chartRect.y + chartRect.height));
  xAxisPath.addLine(new Point(chartRect.x + chartRect.width, chartRect.y + chartRect.height));
  drawContext.addPath(xAxisPath);
  drawContext.strokePath();
  
  // Draw yield curve line
  if (yieldData.length > 1) {
    const curvePath = new Path();
    drawContext.setStrokeColor(new Color("#007AFF"));
    drawContext.setLineWidth(2);
    
    for (let i = 0; i < yieldData.length; i++) {
      const x = chartRect.x + (i / (yieldData.length - 1)) * chartRect.width;
      const normalizedYield = (yieldData[i].yield - yMin) / adjustedYieldRange;
      const y = chartRect.y + chartRect.height - (normalizedYield * chartRect.height);
      
      if (i === 0) {
        curvePath.move(new Point(x, y));
      } else {
        curvePath.addLine(new Point(x, y));
      }
      
      // Draw data points
      const pointRect = new Rect(x - 2, y - 2, 4, 4);
      drawContext.setFillColor(new Color("#007AFF"));
      drawContext.fillEllipse(pointRect);
    }
    
    drawContext.addPath(curvePath);
    drawContext.strokePath();
  }
  
  // Labels and title
  drawContext.setFont(Font.boldSystemFont(12));
  drawContext.setTextColor(Color.white());
  
  // Title
  const titleText = "US Treasury Yield Curve";
  const titleRect = new Rect(10, 5, WIDGET_SIZE.width - 20, 15);
  drawContext.drawTextInRect(titleText, titleRect);
  
  // Date and cache status
  drawContext.setFont(Font.systemFont(10));
  drawContext.setTextColor(new Color("#999999"));
  let statusText = `${date}`;
  if (cacheStatus) {
    statusText += ` • ${cacheStatus}`;
  }
  const dateRect = new Rect(10, WIDGET_SIZE.height - 15, WIDGET_SIZE.width - 20, 12);
  drawContext.drawTextInRect(statusText, dateRect);
  
  // Y-axis labels (yield percentages)
  drawContext.setFont(Font.systemFont(8));
  drawContext.setTextColor(new Color("#999999"));
  for (let i = 0; i <= 4; i++) {
    const yieldValue = yMin + (i / 4) * adjustedYieldRange;
    const y = chartRect.y + chartRect.height - (i / 4) * chartRect.height;
    const labelRect = new Rect(5, y - 6, 30, 12);
    drawContext.drawTextInRect(`${yieldValue.toFixed(1)}%`, labelRect);
  }
  
  // X-axis labels (maturities) - show every other label to avoid crowding
  for (let i = 0; i < yieldData.length; i += 2) {
    const x = chartRect.x + (i / (yieldData.length - 1)) * chartRect.width;
    const labelRect = new Rect(x - 15, chartRect.y + chartRect.height + 5, 30, 12);
    drawContext.drawTextInRect(yieldData[i].label, labelRect);
  }
  
  return drawContext.getImage();
}

// Main widget function
async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#1c1c1e");
  
  // Fetch yield data
  const data = await fetchYieldData();
  
  if (data && data.yieldData && data.yieldData.length > 0) {
    // Create and add chart image
    const chartImage = createYieldCurveChart(data.yieldData, data.date, data.cacheStatus);
    const imageWidget = widget.addImage(chartImage);
    imageWidget.centerAlignImage();
  } else {
    // Fallback display
    widget.addSpacer(20);
    const titleText = widget.addText("US Treasury Yield Curve");
    titleText.font = Font.boldSystemFont(16);
    titleText.textColor = Color.white();
    titleText.centerAlignText();
    
    widget.addSpacer(10);
    const errorText = widget.addText("Unable to fetch current data");
    errorText.font = Font.systemFont(12);
    errorText.textColor = Color.red();
    errorText.centerAlignText();
    
    widget.addSpacer(20);
  }
  
  return widget;
}

// Run the widget
if (config.runsInWidget) {
  const widget = await createWidget();
  Script.setWidget(widget);
} else {
  // For testing in app
  const widget = await createWidget();
  await widget.presentMedium();
}

Script.complete();
