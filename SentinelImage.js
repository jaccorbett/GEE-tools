Map.setOptions('HYBRID');
var iteration = null;
var previousDateLabel = null;
var previousNextLabel = null;

// Function to add the selected rectangle to the map.
var addGeometryToMap = function(geometry) {
  processSelectedArea(geometry);
  drawingTools.setShape(null)
  clearGeometry();
};

// Allow user to select rectangle over area.
var processSelectedArea = function(geometry) {

  var startDate = '2020-01-01'
  var endDate = '2024-01-01'
  var cloudCover = 20
  
  var vidDim = 768
  var vidFPS = 1
  
  var visMin = 0
  var visMax = 4000
  var visGamma = 1.6
  var bands = ['B4', 'B3', 'B2']
  
  var dateScale = 20
  var dateOffset = '2%'
  var dateMargin = '2%'
  
  var s2collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudCover));
  
  print(s2collection);
  
  var s2 = s2collection.first().select(bands);
  var projection = s2.select('B4').projection().getInfo();
  
  var videoArg = {
    dimensions: vidDim,
    region: geometry,
    framesPerSecond: vidFPS,
    crs: projection.crs,
  };  
  
  var vis = {
    min: visMin,
    max: visMax,
    gamma: visGamma,
    bands: bands,
    forceRgbOutput: true
  };
  
  var text = require('users/jacorbett/packages:gena_text');
  var annotations = [{ 
    position: 'bottom', 
    offset: dateOffset,
    margin: dateMargin,
    property: 'label',
    scale: dateScale // Change scale depending on map scale
  }];
  
    function addText(image) {
    var date = ee.Date(image.get('system:time_start')).format('dd MMM YYYY');
    var imageID = image.get('system:index');
    var visualizedImage = image.visualize(vis).set('label', date);
    var annotated = text.annotateImage(visualizedImage, {}, geometry, annotations);
    return annotated;
  }
  
  var s2Annotated = s2collection.map(addText);
  print(ui.Thumbnail(s2Annotated, videoArg));


  // Create a variable to keep track of the current image index
  var currentIndex = 0;

  // Function to update the displayed image
  var updateDisplayedImage = function () {
    var currentImage = ee.Image(s2collection.toList(s2collection.size()).get(currentIndex));
    var s2clip = currentImage.clip(geometry);

    Map.layers().reset(); // Clear previous layers
    Map.addLayer(s2clip, vis, 'Sentinel-2 RGB');

    // Print image date
    var imageDate = ee.Date(currentImage.get('system:time_start'));
    print('Current Image Date:', imageDate);
  
    var date = ee.Date(currentImage.get('system:time_start')).format('dd MMM YYYY');
    var dateLabel = ui.Label({
      value: date.getInfo(),
      style: {
        fontWeight: 'normal',
        fontSize: '14px',
        margin: '2px'
      }
    });
  
    if (previousDateLabel) {
      Map.remove(previousDateLabel);
    }
  
    Map.add(dateLabel);
    previousDateLabel = dateLabel;

    var projection = currentImage.select('B4').projection().getInfo();
    var exportImage = currentImage.select('B4', 'B3', 'B2');
  
    Export.image.toDrive({
      image: exportImage,
      region: geometry,
      description: 'image_' + currentIndex,
      folder: 'Iceland',
      crs: projection.crs,
      crsTransform: projection.transform
    });
    currentIndex++;
  };

  // Create a button and set its label and callback function
  var nextImageButton = ui.Button('Next Image', updateDisplayedImage);


  if (previousNextLabel) {
      Map.remove(previousNextLabel);
    }
  
  Map.add(nextImageButton);
  previousNextLabel = nextImageButton

  // Initial image display
  updateDisplayedImage();

};

// Function to activate the drawing tools for rectangle selection.
var drawingTools = Map.drawingTools();
var drawEvent;

while (drawingTools.layers().length() > 0) {
  var layer = drawingTools.layers().get(0);
  drawingTools.layers().remove(layer);
}

var dummyGeometry =
    ui.Map.GeometryLayer({geometries: null, name: 'geometry', color: '23cba7'});

drawingTools.layers().add(dummyGeometry);

function clearGeometry() {
  var layers = drawingTools.layers();
  layers.get(0).geometries().remove(layers.get(0).geometries().get(0));
}

var activateDrawingTools = function() {
  clearGeometry();
  Map.drawingTools().setShape('rectangle');
  if (drawEvent) {
    Map.drawingTools().unlisten(drawEvent);
  }
  drawEvent = Map.drawingTools().onDraw(addGeometryToMap);
};

var selectGeometryButton = ui.Button({
  label: 'Select Area',
  onClick: function() {
    activateDrawingTools();
  }
})

Map.add(selectGeometryButton);