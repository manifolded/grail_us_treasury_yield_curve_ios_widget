# US Treasury Yield Curve iOS Widget

A Scriptable widget for iOS that displays the current US Treasury Bond Yield Curve as an interactive line chart.

## Features

- **Real-time Data**: Fetches the latest yield curve data directly from the US Department of Treasury's official XML feed
- **Smart Caching**: Automatically caches data for 12 hours to minimize API calls and improve performance
- **Visual Chart**: Displays the yield curve as a clean line chart with data points
- **Native Drawing**: Uses Scriptable's native DrawContext API for smooth, responsive charts
- **Dark Theme**: Designed with a modern dark theme that matches iOS aesthetics
- **Comprehensive Coverage**: Shows yields for all available maturities (1M, 2M, 3M, 4M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y)
- **Offline Fallback**: Uses cached data even when API is unavailable
- **Cache Status**: Shows whether data is fresh or cached with age information

## Installation

1. Download and install the [Scriptable app](https://scriptable.app) from the App Store
2. Copy the contents of `us_treasury_yield_curve_widget.js` into a new script in Scriptable
3. Run the script to test it works
4. Add a medium-sized Scriptable widget to your home screen
5. Configure the widget to run your Treasury Yield Curve script

## Usage

### Running in Scriptable App
- Open the script in Scriptable and tap the play button
- The script will present a medium-sized widget preview

### Adding to Home Screen
1. Long press on your home screen to enter edit mode
2. Tap the "+" button to add a widget
3. Search for "Scriptable" and select it
4. Choose the "Medium" widget size
5. Add the widget to your home screen
6. Tap on the widget to configure it
7. Select your Treasury Yield Curve script
8. Choose "When Interacting" for the script parameter

## Data Source

The widget fetches data from the official US Department of Treasury XML feed:
```
https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=[YEAR]
```

This feed provides daily Treasury Par Yield Curve Rates and is updated regularly by the Treasury Department.

## Widget Features

### Caching System
- **Automatic Caching**: Data is automatically cached for 12 hours after successful fetch
- **Cache Status Display**: Widget shows cache age (e.g., "Cached 2.3h ago" or "Fresh data")
- **Smart Fallback**: Uses expired cache when API is unavailable
- **Storage Options**: Uses local storage by default (configurable to iCloud storage)
- **Performance**: Reduces API calls and improves widget loading speed

### Error Handling
- If data cannot be fetched, the widget displays an error message
- Graceful handling of missing or invalid data points
- Fallback display when no data is available
- Uses expired cached data as fallback when API is unavailable

## Customization

You can customize the widget by modifying these constants at the top of the script:

```javascript
// Widget dimensions
const WIDGET_SIZE = { width: 350, height: 150 };

// Chart padding
const CHART_PADDING = { top: 25, right: 20, bottom: 35, left: 40 };

// Cache settings
const CACHE_DURATION_HOURS = 12; // How long to keep cached data
const USE_ICLOUD_STORAGE = false; // Set to false for local storage
```

### Color Customization
- Background: `#1c1c1e` (dark gray)
- Yield curve line: `#007AFF` (iOS blue)
- Grid lines: `#333333` (dark gray)
- Axes: `#666666` (medium gray)
- Text: White and `#999999` (light gray)

## Technical Details

### Dependencies
- Scriptable app (iOS)
- Internet connection for data fetching

### API Limitations
- Data is typically updated once per business day
- Weekend and holiday data may not be available immediately
- Historical data is included in the same feed

### Performance
- Widget uses native Scriptable DrawContext for efficient rendering
- Minimal network requests (one XML fetch per update)
- Automatic scaling and responsive design

## Troubleshooting

### Widget Shows "Unable to fetch current data"
1. Check your internet connection
2. Verify the Treasury website is accessible
3. Try running the script manually in Scriptable to see detailed error messages
4. Check if cached data is being used as fallback (look for cache status in widget)

### Widget Appears Blank
1. Ensure you've selected the correct script in widget settings
2. Try deleting and re-adding the widget
3. Check that the script runs without errors in the Scriptable app

### Old Data Showing
1. The Treasury data is updated once per business day
2. Weekends and holidays may show the last business day's data
3. Check the cache status indicator - may be showing cached data
4. To force fresh data, you can clear the cache (see debugging section below)

### Cache-Related Issues
1. **Clear Cache**: Run `await clearCache()` in the Scriptable console
2. **Check Cache Status**: Run `await getCacheInfo()` to see cache details
3. **Change Storage**: Modify `USE_ICLOUD_STORAGE` to switch between iCloud and local storage

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Data provided by the US Department of Treasury
- Built for the Scriptable app by Simon B. Støvring
