Map.setOptions('HYBRID');
var iteration = null;
var previousDateLabel = null;

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
  var cloudCover = 10
  
  var vidDim = 768
  var vidFPS = 1
  
  var visMin = 0
  var visMax = 5000
  var visGamma = 4
  var bands = ['B4', 'B3', 'B2']
  
  var dateScale = 50
  var dateOffset = '2%'
  var dateMargin = '2%'
  
  iteration++;
  print(iteration);
  
  var s2collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(startDate, endDate)
    //.filterMetadata('MGRS_TILE', 'equals', '47XML')  // Change depending on region    
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudCover));

  var collectionSize = s2collection.size();
  if (collectionSize.getInfo() === 0) {
    print('There are no images available');
    return;
  }
  
  var s2 = s2collection.first().select(bands);
  var s2clip = s2.clip(geometry);
  var projection = s2.select('B4').projection().getInfo();
  
  var videoArg = {
    dimensions: vidDim,
    region: geometry,
    framesPerSecond: vidFPS,
    crs: projection.crs,
  };
  
  var text = require('users/jacorbett/packages:gena_text');
  var annotations = [{ 
    position: 'bottom', 
    offset: dateOffset,
    margin: dateMargin,
    property: 'label',
    scale: dateScale // Change scale depending on map scale
  }];
  
  var vis = {
    min: visMin,
    max: visMax,
    gamma: visGamma,
    bands: bands,
    forceRgbOutput: true
  };
  
  function addText(image) {
    var date = ee.Date(image.get('system:time_start')).format('dd MMM YYYY');
    var imageID = image.get('system:index');
    var visualizedImage = image.visualize(vis).set('label', date);
    var annotated = text.annotateImage(visualizedImage, {}, geometry, annotations);
    return annotated;
  }
  
  var s2Annotated = s2collection.map(addText);
  

  var date = ee.Date(s2.get('system:time_start')).format('dd MMM YYYY');
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
  
  Export.video.toDrive({
    collection: s2Annotated,
    region: geometry,
    description: 'timelapse_' + iteration,
    folder: 'GEE',
    dimensions: vidDim,
    framesPerSecond: vidFPS,
    crs: projection.crs,
    crsTransform: projection.transform
  });
  
  /*
  Export.image.toDrive({
    image: s2,
    region: geometry,
    description: 'image_' + iteration,
    folder: 'GEE',
    crs: projection.crs,
    crsTransform: projection.transform
  });*/  
  
  print(s2collection);
  print(s2);
  //Map.centerObject(geometry, 12);
  Map.addLayer(s2clip, vis, 'Sentinel-2 RGB ' + iteration);
  print(ui.Thumbnail(s2Annotated, videoArg));
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
