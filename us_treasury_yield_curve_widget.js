
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
const USE_ICLOUD_STORAGE = false; // Set to false to use local storage instead

// Historical data configuration
const SHOW_HISTORICAL_CURVES = true; // Set to false to show only current data
const HISTORICAL_PERIODS = [7, 14]; // Days ago (1 week, 2 weeks)

// Cache management functions

/**
 * Returns the appropriate FileManager instance based on storage preference
 * @returns {FileManager} Either iCloud or local FileManager
 */
function getFileManager() {
  return USE_ICLOUD_STORAGE ? FileManager.iCloud() : FileManager.local();
}

/**
 * Constructs the file path for cache files, with date suffix for historical data
 * @param {string} date_suffix - Date suffix (YYYYMMDD format) for date-specific caches (required)
 * @returns {string} Full file path for the cache file
 */
function getCacheFilePath(date_suffix) {
  if (!date_suffix) {
    throw new Error("Date suffix is required for cache file path");
  }
  const fm = getFileManager();
  const fileName = `treasury_yield_cache_${date_suffix}.json`;
  return fm.joinPath(fm.documentsDirectory(), fileName);
}

// Utility functions for date calculations

/**
 * Checks if a given date falls on a weekend (Saturday or Sunday)
 * @param {Date} date - The date to check
 * @returns {boolean} True if the date is a weekend
 */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Checks if a given date is a US market holiday
 * Note: This is a basic implementation covering major holidays
 * @param {Date} date - The date to check
 * @returns {boolean} True if the date is a US holiday
 */
function isUSHoliday(date) {
  // Basic US market holidays - you can expand this list
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // New Year's Day
  if (month === 0 && day === 1) return true;
  
  // Independence Day
  if (month === 6 && day === 4) return true;
  
  // Christmas Day
  if (month === 11 && day === 25) return true;
  
  // Add more holidays as needed
  return false;
}

/**
 * Determines if a given date is a business day (not weekend or holiday)
 * @param {Date} date - The date to check
 * @returns {boolean} True if the date is a business day
 */
function isBusinessDay(date) {
  return !isWeekend(date) && !isUSHoliday(date);
}

/**
 * Finds the closest previous business day from a given date
 * Iterates backwards until it finds a business day
 * @param {Date} date - The starting date
 * @returns {Date} The closest previous business day
 */
function getClosestPreviousBusinessDay(date) {
  const result = new Date(date);
  
  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() - 1);
  }
  
  return result;
}

/**
 * Formats a Date object into YYYY-MM-DD format for API calls
 * @param {Date} date - The date to format
 * @returns {string} Date string in YYYY-MM-DD format
 */
function formatDateForAPI(date) {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

/**
 * Calculates historical dates for yield curve comparison
 * Adjusts dates to business days and creates descriptive labels
 * @returns {Array} Array of objects containing historical date information
 */
function getHistoricalDates() {
  const today = new Date();
  const dates = [];
  
  for (const daysAgo of HISTORICAL_PERIODS) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysAgo);
    
    const businessDay = getClosestPreviousBusinessDay(targetDate);
    dates.push({
      daysAgo: daysAgo,
      date: businessDay,
      dateString: formatDateForAPI(businessDay),
      label: daysAgo === 7 ? "1 week ago" : daysAgo === 14 ? "2 weeks ago" : `${daysAgo} days ago`
    });
  }
  
  return dates;
}

/**
 * Retrieves cached yield data for a specific date
 * Returns cached data if it exists, regardless of age
 * @param {string} dateString - Date string (YYYY-MM-DD) for specific cache (required)
 * @returns {Object|null} Cached data object with metadata, or null if no cache exists
 */
async function getCachedData(dateString) {
  if (!dateString) {
    throw new Error("Date string is required for cache retrieval");
  }
  try {
    const fm = getFileManager();
    const date_suffix = dateString.replace(/-/g, '');
    const cachePath = getCacheFilePath(date_suffix);
    
    if (!fm.fileExists(cachePath)) {
      return null;
    }
    
    const cacheString = fm.readString(cachePath);
    const cacheData = JSON.parse(cacheString);
    
    console.log(`Using cached data for ${dateString}`);
    // Add cache metadata to the result
    const result = { ...cacheData };
    result.cacheStatus = "Cached data";
    result.fromCache = true;
    return result;
  } catch (error) {
    console.error(`Error reading cache for ${dateString}:`, error);
    return null;
  }
}

/**
 * Stores yield data in cache for future retrieval
 * Creates date-specific cache files for historical data
 * @param {Object} data - The yield data object to cache
 * @param {string} dateString - Date string (YYYY-MM-DD) for specific cache (required)
 */
async function setCachedData(data, dateString) {
  if (!dateString) {
    throw new Error("Date string is required for cache storage");
  }
  try {
    const fm = getFileManager();
    const date_suffix = dateString.replace(/-/g, '');
    const cachePath = getCacheFilePath(date_suffix);
    
    const cacheString = JSON.stringify(data);
    fm.writeString(cachePath, cacheString);
    console.log(`Data cached successfully for ${dateString}`);
  } catch (error) {
    console.error(`Error writing cache for ${dateString}:`, error);
  }
}

/**
 * Fetches Treasury yield curve data for a specific date from API or cache
 * Handles date matching, XML parsing, and data extraction
 * @param {string|null} targetDateString - Target date (YYYY-MM-DD), null for most recent
 * @param {number|null} year - Year for API call, defaults to current year
 * @returns {Object|null} Yield data object with date, yieldData array, and cache metadata
 */
async function fetchYieldDataForDate(targetDateString = null, year = null) {
  const useYear = year || currentYear;
  const dateString = targetDateString;
  
  // For current data (no targetDateString), we need to determine today's date first
  // We'll get the most recent date from the API response and use that for caching
  let cacheKey = dateString;
  
  // First try to get cached data (only if we have a specific date)
  if (cacheKey) {
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }
  
  // If no valid cache, fetch from API
  try {
    console.log(`Fetching fresh data from Treasury API for ${dateString || 'current'}...`);
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${useYear}`;
    const req = new Request(url);
    const xmlString = await req.loadString();
    
    // Parse XML manually since Scriptable doesn't have full XML parser
    const entries = xmlString.match(/<entry[^>]*>[\s\S]*?<\/entry>/g);
    if (!entries || entries.length === 0) {
      throw new Error("No data entries found");
    }
    
    // Find the entry for the target date, or use the most recent if no target date
    let targetEntry;
    if (dateString) {
      // Look for the specific date
      targetEntry = entries.find(entry => {
        const dateMatch = entry.match(/<d:NEW_DATE[^>]*>(.*?)<\/d:NEW_DATE>/);
        return dateMatch && dateMatch[1] === dateString;
      });
      
      if (!targetEntry) {
        console.log(`No data found for ${dateString}, looking for closest earlier date`);
        // Find the closest earlier date
        const targetDate = new Date(dateString);
        let closestEntry = null;
        let closestDate = null;
        
        for (const entry of entries) {
          const dateMatch = entry.match(/<d:NEW_DATE[^>]*>(.*?)<\/d:NEW_DATE>/);
          if (dateMatch) {
            const entryDate = new Date(dateMatch[1]);
            if (entryDate <= targetDate && (!closestDate || entryDate > closestDate)) {
              closestDate = entryDate;
              closestEntry = entry;
            }
          }
        }
        
        if (closestEntry) {
          targetEntry = closestEntry;
          console.log(`Using closest available date: ${closestDate.toISOString().split('T')[0]}`);
        } else {
          throw new Error(`No data available for or before ${dateString}`);
        }
      }
    } else {
      // Get the most recent entry (last in the array)
      targetEntry = entries[entries.length - 1];
    }
    
    // Extract date
    const dateMatch = targetEntry.match(/<d:NEW_DATE[^>]*>(.*?)<\/d:NEW_DATE>/);
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
      const match = targetEntry.match(regex);
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
    
    // Cache the successful result using the actual date from the API response
    const actualCacheKey = dateString || date;
    await setCachedData(result, actualCacheKey);
    
    return result;
  } catch (error) {
    console.error(`Error fetching yield data for ${dateString || 'current'}:`, error);
    
    // If API fails, try to return any cached data as fallback
    // Only try fallback if we have a specific date to look for
    if (dateString) {
      const fallbackCache = await getCachedData(dateString);
      if (fallbackCache) {
        console.log(`Using cached data as fallback for ${dateString}`);
        return fallbackCache;
      }
    }
    
    return null;
  }
}

/**
 * Wrapper function for fetching current yield data (backwards compatibility)
 * @returns {Object|null} Current yield data object
 */
async function fetchYieldData() {
  return await fetchYieldDataForDate();
}

/**
 * Fetches all yield data including current and historical curves
 * Orchestrates parallel fetching of multiple dates for performance
 * @returns {Object} Object containing current and historical yield data keyed by period
 */
async function fetchAllYieldData() {
  const results = {};
  
  // Fetch current data
  console.log("Fetching current yield data...");
  const currentData = await fetchYieldDataForDate();
  if (currentData) {
    results.current = currentData;
  }
  
  // Fetch historical data if enabled
  if (SHOW_HISTORICAL_CURVES) {
    const historicalDates = getHistoricalDates();
    
    for (const histDate of historicalDates) {
      console.log(`Fetching historical data for ${histDate.label} (${histDate.dateString})...`);
      try {
        const historicalData = await fetchYieldDataForDate(histDate.dateString, histDate.date.getFullYear());
        if (historicalData && historicalData.yieldData && historicalData.yieldData.length > 0) {
          results[`days_${histDate.daysAgo}`] = {
            ...historicalData,
            label: histDate.label,
            daysAgo: histDate.daysAgo
          };
        }
      } catch (error) {
        console.error(`Failed to fetch data for ${histDate.label}:`, error);
      }
    }
  }
  
  return results;
}

/**
 * Clears the cache file for debugging or manual refresh
 * Removes today's cache file
 * @param {string|null} dateString - Date string (YYYY-MM-DD) to clear, defaults to today
 * @returns {boolean} True if cache was cleared, false if no cache existed
 */
async function clearCache(dateString = null) {
  try {
    const fm = getFileManager();
    const targetDate = dateString || formatDateForAPI(new Date());
    const cachePath = getCacheFilePath(targetDate.replace(/-/g, ''));
    
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

/**
 * Retrieves detailed information about the cache status for a specific date
 * Useful for debugging cache behavior and data existence
 * @param {string|null} dateString - Date string (YYYY-MM-DD) to check, defaults to today
 * @returns {Object} Cache information including existence and metadata
 */
async function getCacheInfo(dateString = null) {
  try {
    const fm = getFileManager();
    const targetDate = dateString || formatDateForAPI(new Date());
    const cachePath = getCacheFilePath(targetDate.replace(/-/g, ''));
    
    if (!fm.fileExists(cachePath)) {
      return { exists: false };
    }
    
    const cacheString = fm.readString(cachePath);
    const cacheData = JSON.parse(cacheString);
    
    return {
      exists: true,
      dataDate: cacheData.date
    };
  } catch (error) {
    console.error("Error getting cache info:", error);
    return { exists: false, error: error.message };
  }
}

/**
 * Creates a visual yield curve chart with support for multiple historical curves
 * Renders current and historical yield curves with different colors and styling
 * @param {Object} allData - Object containing current and historical yield data
 * @param {string|null} cacheStatus - Optional cache status override for display
 * @returns {Image} Rendered chart image for display in widget
 */
function createYieldCurveChart(allData, cacheStatus = null) {
  // If old format (single curve), convert to new format
  if (allData.yieldData && !allData.current) {
    allData = { current: allData };
  }
  const drawContext = new DrawContext();
  drawContext.size = new Size(WIDGET_SIZE.width, WIDGET_SIZE.height);
  drawContext.opaque = false;
  drawContext.respectScreenScale = true;
  
  // Background
  const bgRect = new Rect(0, 0, WIDGET_SIZE.width, WIDGET_SIZE.height);
  drawContext.setFillColor(new Color("#1c1c1e"));
  drawContext.fillRect(bgRect);
  
  // Extract current data
  const currentData = allData.current;
  if (!currentData || !currentData.yieldData || currentData.yieldData.length === 0) {
    // Error message
    drawContext.setFont(Font.systemFont(14));
    drawContext.setTextColor(Color.red());
    drawContext.drawTextInRect("No yield data available", new Rect(10, 60, WIDGET_SIZE.width - 20, 30));
    return drawContext.getImage();
  }
  
  // Define colors for different curves
  const curveColors = {
    current: "#007AFF",     // iOS blue
    days_7: "#FF9500",      // iOS orange  
    days_14: "#FF3B30"      // iOS red
  };
  
  // Collect all yield data for scaling
  const allYieldValues = [];
  const curves = [];
  
  for (const [key, data] of Object.entries(allData)) {
    if (data && data.yieldData && data.yieldData.length > 0) {
      curves.push({ key, data });
      allYieldValues.push(...data.yieldData.map(d => d.yield));
    }
  }
  
  // Find min and max yields for scaling across all curves
  const minYield = Math.min(...allYieldValues);
  const maxYield = Math.max(...allYieldValues);
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
  
  // Draw yield curves (historical first, then current on top)
  const sortedCurves = curves.sort((a, b) => {
    if (a.key === 'current') return 1;
    if (b.key === 'current') return -1;
    return 0;
  });
  
  for (const curve of sortedCurves) {
    const { key, data } = curve;
    const yieldData = data.yieldData;
    const color = curveColors[key] || "#666666";
    const lineWidth = key === 'current' ? 2.5 : 1.5;
    const alpha = key === 'current' ? 1.0 : 0.7;
    
    if (yieldData.length > 1) {
      const curvePath = new Path();
      drawContext.setStrokeColor(new Color(color, alpha));
      drawContext.setLineWidth(lineWidth);
      
      for (let i = 0; i < yieldData.length; i++) {
        const x = chartRect.x + (i / (yieldData.length - 1)) * chartRect.width;
        const normalizedYield = (yieldData[i].yield - yMin) / adjustedYieldRange;
        const y = chartRect.y + chartRect.height - (normalizedYield * chartRect.height);
        
        if (i === 0) {
          curvePath.move(new Point(x, y));
        } else {
          curvePath.addLine(new Point(x, y));
        }
        
        // Draw data points only for current curve
        if (key === 'current') {
          const pointRect = new Rect(x - 2, y - 2, 4, 4);
          drawContext.setFillColor(new Color(color, alpha));
          drawContext.fillEllipse(pointRect);
        }
      }
      
      drawContext.addPath(curvePath);
      drawContext.strokePath();
    }
  }
  
  // Labels and title
  drawContext.setFont(Font.boldSystemFont(12));
  drawContext.setTextColor(Color.white());
  
  // Title
  const titleText = "US Treasury Yield Curve";
  const titleRect = new Rect(10, 5, WIDGET_SIZE.width - 20, 15);
  drawContext.drawTextInRect(titleText, titleRect);
  
  // Legend for multiple curves
  if (curves.length > 1) {
    drawContext.setFont(Font.systemFont(8));
    let legendY = chartRect.y + chartRect.height + 18;
    let legendX = chartRect.x;
    
    for (const curve of curves) {
      const { key, data } = curve;
      const color = curveColors[key] || "#666666";
      const label = key === 'current' ? 'Current' : data.label || key;
      
      // Draw legend color indicator
      const legendColorRect = new Rect(legendX, legendY, 8, 2);
      drawContext.setFillColor(new Color(color));
      drawContext.fillRect(legendColorRect);
      
      // Draw legend text
      drawContext.setTextColor(new Color("#999999"));
      const legendTextRect = new Rect(legendX + 12, legendY - 3, 50, 8);
      drawContext.drawTextInRect(label, legendTextRect);
      
      legendX += 60;
    }
  }
  
  // Date and cache status
  drawContext.setFont(Font.systemFont(10));
  drawContext.setTextColor(new Color("#999999"));
  let statusText = `${currentData.date}`;
  if (cacheStatus || currentData.cacheStatus) {
    statusText += ` • ${cacheStatus || currentData.cacheStatus}`;
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
  const referenceYieldData = currentData.yieldData;
  for (let i = 0; i < referenceYieldData.length; i += 2) {
    const x = chartRect.x + (i / (referenceYieldData.length - 1)) * chartRect.width;
    const labelRect = new Rect(x - 15, chartRect.y + chartRect.height + 5, 30, 12);
    drawContext.drawTextInRect(referenceYieldData[i].label, labelRect);
  }
  
  return drawContext.getImage();
}

/**
 * Main function that creates and configures the Scriptable widget
 * Orchestrates data fetching, chart creation, and error handling
 * @returns {ListWidget} Configured widget ready for display
 */
async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#1c1c1e");
  
  // Fetch all yield data (current + historical)
  const allData = await fetchAllYieldData();
  
  if (allData.current && allData.current.yieldData && allData.current.yieldData.length > 0) {
    // Create and add chart image
    const chartImage = createYieldCurveChart(allData);
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
