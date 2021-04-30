window.CESIUM_BASE_URL = "../../Source/";

import {
  Cartesian3,
  Cartesian2,
  createWorldTerrain,
  defined,
  formatError,
  Math as CesiumMath,
  objectToQuery,
  queryToObject,
  CzmlDataSource,
  GeoJsonDataSource,
  KmlDataSource,
  TileMapServiceImageryProvider,
  Viewer,
  viewerCesiumInspectorMixin,
  viewerDragDropMixin,
  Rectangle,
  StripeMaterialProperty,
  Color,
  HeightReference,
  LabelStyle,
  VerticalOrigin,
  Cartographic,
  Math,
} from "../../Source/Cesium.js";

const drawSize = 0.0005;
var drawFlag = 0;
function main() {
  /*
     Options parsed from query string:
       source=url          The URL of a CZML/GeoJSON/KML data source to load at startup.
                           Automatic data type detection uses file extension.
       sourceType=czml/geojson/kml
                           Override data type detection for source.
       flyTo=false         Don't automatically fly to the loaded source.
       tmsImageryUrl=url   Automatically use a TMS imagery provider.
       lookAt=id           The ID of the entity to track at startup.
       stats=true          Enable the FPS performance display.
       inspector=true      Enable the inspector widget.
       debug=true          Full WebGL error reporting at substantial performance cost.
       theme=lighter       Use the dark-text-on-light-background theme.
       scene3DOnly=true    Enable 3D only mode.
       view=longitude,latitude,[height,heading,pitch,roll]
                           Automatically set a camera view. Values in degrees and meters.
                           [height,heading,pitch,roll] default is looking straight down, [300,0,-90,0]
       saveCamera=false    Don't automatically update the camera view in the URL when it changes.
     */
  var mousePosition = null;
  var selectedLocation = null;
  var endUserOptions = queryToObject(window.location.search.substring(1));

  var imageryProvider;
  if (defined(endUserOptions.tmsImageryUrl)) {
    imageryProvider = new TileMapServiceImageryProvider({
      url: endUserOptions.tmsImageryUrl,
    });
  }

  var loadingIndicator = document.getElementById("loadingIndicator");
  var viewer;
  try {
    var hasBaseLayerPicker = !defined(imageryProvider);
    viewer = new Viewer("cesiumContainer", {
      imageryProvider: imageryProvider,
      baseLayerPicker: hasBaseLayerPicker,
      scene3DOnly: endUserOptions.scene3DOnly,
      requestRenderMode: true,
    });

    if (hasBaseLayerPicker) {
      var viewModel = viewer.baseLayerPicker.viewModel;
      viewModel.selectedTerrain = viewModel.terrainProviderViewModels[1];
    } else {
      viewer.terrainProvider = createWorldTerrain({
        requestWaterMask: true,
        requestVertexNormals: true,
      });
    }
  } catch (exception) {
    loadingIndicator.style.display = "none";
    var message = formatError(exception);
    console.error(message);
    if (!document.querySelector(".cesium-widget-errorPanel")) {
      //eslint-disable-next-line no-alert
      window.alert(message);
    }
    return;
  }

  viewer.extend(viewerDragDropMixin);
  if (endUserOptions.inspector) {
    viewer.extend(viewerCesiumInspectorMixin);
  }

  var showLoadError = function (name, error) {
    var title = "An error occurred while loading the file: " + name;
    var message =
      "An error occurred while loading the file, which may indicate that it is invalid.  A detailed error report is below:";
    viewer.cesiumWidget.showErrorPanel(title, message, error);
  };

  viewer.dropError.addEventListener(function (viewerArg, name, error) {
    showLoadError(name, error);
  });

  var scene = viewer.scene;
  var context = scene.context;
  if (endUserOptions.debug) {
    context.validateShaderProgram = true;
    context.validateFramebuffer = true;
    context.logShaderCompilation = true;
    context.throwOnWebGLError = true;
  }

  var view = endUserOptions.view;
  var source = endUserOptions.source;
  if (defined(source)) {
    var sourceType = endUserOptions.sourceType;
    if (!defined(sourceType)) {
      // autodetect using file extension if not specified
      if (/\.czml$/i.test(source)) {
        sourceType = "czml";
      } else if (
        /\.geojson$/i.test(source) ||
        /\.json$/i.test(source) ||
        /\.topojson$/i.test(source)
      ) {
        sourceType = "geojson";
      } else if (/\.kml$/i.test(source) || /\.kmz$/i.test(source)) {
        sourceType = "kml";
      }
    }

    var loadPromise;
    if (sourceType === "czml") {
      loadPromise = CzmlDataSource.load(source);
    } else if (sourceType === "geojson") {
      loadPromise = GeoJsonDataSource.load(source);
    } else if (sourceType === "kml") {
      loadPromise = KmlDataSource.load(source, {
        camera: scene.camera,
        canvas: scene.canvas,
      });
    } else {
      showLoadError(source, "Unknown format.");
    }

    if (defined(loadPromise)) {
      viewer.dataSources
        .add(loadPromise)
        .then(function (dataSource) {
          var lookAt = endUserOptions.lookAt;
          if (defined(lookAt)) {
            var entity = dataSource.entities.getById(lookAt);
            if (defined(entity)) {
              viewer.trackedEntity = entity;
            } else {
              var error =
                'No entity with id "' +
                lookAt +
                '" exists in the provided data source.';
              showLoadError(source, error);
            }
          } else if (!defined(view) && endUserOptions.flyTo !== "false") {
            viewer.flyTo(dataSource);
          }
        })
        .otherwise(function (error) {
          showLoadError(source, error);
        });
    }
  }

  if (endUserOptions.stats) {
    scene.debugShowFramesPerSecond = true;
  }

  var theme = endUserOptions.theme;
  if (defined(theme)) {
    if (endUserOptions.theme === "lighter") {
      document.body.classList.add("cesium-lighter");
      viewer.animation.applyThemeChanges();
    } else {
      var error = "Unknown theme: " + theme;
      viewer.cesiumWidget.showErrorPanel(error, "");
    }
  }

  if (defined(view)) {
    var splitQuery = view.split(/[ ,]+/);
    if (splitQuery.length > 1) {
      var longitude = !isNaN(+splitQuery[0]) ? +splitQuery[0] : 0.0;
      var latitude = !isNaN(+splitQuery[1]) ? +splitQuery[1] : 0.0;
      var height =
        splitQuery.length > 2 && !isNaN(+splitQuery[2])
          ? +splitQuery[2]
          : 300.0;
      var heading =
        splitQuery.length > 3 && !isNaN(+splitQuery[3])
          ? CesiumMath.toRadians(+splitQuery[3])
          : undefined;
      var pitch =
        splitQuery.length > 4 && !isNaN(+splitQuery[4])
          ? CesiumMath.toRadians(+splitQuery[4])
          : undefined;
      var roll =
        splitQuery.length > 5 && !isNaN(+splitQuery[5])
          ? CesiumMath.toRadians(+splitQuery[5])
          : undefined;

      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(longitude, latitude, height),
        orientation: {
          heading: heading,
          pitch: pitch,
          roll: roll,
        },
      });
    }
  }

  var camera = viewer.camera;
  function saveCamera() {
    var position = camera.positionCartographic;
    var hpr = "";
    if (defined(camera.heading)) {
      hpr =
        "," +
        CesiumMath.toDegrees(camera.heading) +
        "," +
        CesiumMath.toDegrees(camera.pitch) +
        "," +
        CesiumMath.toDegrees(camera.roll);
    }
    endUserOptions.view =
      CesiumMath.toDegrees(position.longitude) +
      "," +
      CesiumMath.toDegrees(position.latitude) +
      "," +
      position.height +
      hpr;
    history.replaceState(undefined, "", "?" + objectToQuery(endUserOptions));
  }

  var timeout;
  if (endUserOptions.saveCamera !== "false") {
    camera.changed.addEventListener(function () {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(saveCamera, 1000);
    });
  }

  loadingIndicator.style.display = "none";

  window.viewer = viewer;
  const toolbar = document.querySelector("div.cesium-viewer-toolbar");
  const modeButton = document.querySelector(
    "span.cesium-sceneModePicker-wrapper"
  );
  const myButton = document.createElement("button");
  myButton.classList.add("cesium-button", "cesium-toolbar-button");
  myButton.innerHTML = "&#x270F";
  toolbar.insertBefore(myButton, modeButton);

  viewer.scene.canvas.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();
      mousePosition = new Cartesian3(event.clientX, event.clientY);
      selectedLocation = viewer.scene.pickPosition(mousePosition);

      setMarkerInPos(Cartographic.fromCartesian(selectedLocation));
    },
    false
  );

  myButton.addEventListener("click", function () {
    if (drawFlag == 0) {
      drawFlag = 1;
    } else {
      drawFlag = 0;
    }

    console.log("Draw Flag:" + drawFlag);
    var x = document.getElementById("drawNum").value;
    console.log("Value:" + parseInt(x));

    /*viewer.entities.add({
      rectangle: {
        coordinates: Rectangle.fromDegrees(-100.0, 20.0, -90.0, 30.0),
        material: new StripeMaterialProperty({
          evenColor: Color.WHITE,
          oddColor: Color.BLUE,
          repeat: 5,
        }),
      },
    });
    */
  });
}

//Cartographic.fromCartesian(selectedLocation)
function drawRight(positionCartographic) {
  positionCartographic.longitude = positionCartographic.longitude + drawSize;

  return Math.toDegrees(positionCartographic.longitude);
}
function drawLeft(positionCartographic) {
  positionCartographic.longitude = positionCartographic.longitude - drawSize;
  return Math.toDegrees(positionCartographic.longitude);
}
function drawUp(positionCartographic) {
  positionCartographic.latitude = positionCartographic.latitude + drawSize;
  return Math.toDegrees(positionCartographic.latitude);
}
function drawDown(positionCartographic) {
  positionCartographic.latitude = positionCartographic.latitude - drawSize;
  return Math.toDegrees(positionCartographic.latitude);
}

function drawHalfRight(positionCartographic) {
  positionCartographic.longitude =
    positionCartographic.longitude + drawSize / 2;
  return Math.toDegrees(positionCartographic.longitude);
}
function drawHalfLeft(positionCartographic) {
  positionCartographic.longitude =
    positionCartographic.longitude - drawSize / 2;
  return Math.toDegrees(positionCartographic.longitude);
}
function drawHalfUp(positionCartographic) {
  positionCartographic.latitude = positionCartographic.latitude + drawSize / 2;
  return Math.toDegrees(positionCartographic.latitude);
}
function drawHalfDown(positionCartographic) {
  positionCartographic.latitude = positionCartographic.latitude - drawSize / 2;
  return Math.toDegrees(positionCartographic.latitude);
}

function setMarkerInPos(positionCartographic) {
  console.log(
    "Position:" +
      Cartesian3.fromRadians(
        positionCartographic.longitude,
        positionCartographic.latitude,
        10
      )
  );
  viewer.pickTranslucentDepth = true;
  /*const locationMarker = viewer.entities.add({
    name: "location",
    position: Cartesian3.fromRadians(
      positionCartographic.longitude,
      positionCartographic.latitude,
      10
    ),
    point: {
      pixelSize: 5,
      color: Color.RED,
      outlineColor: Color.WHITE,
      outlineWidth: 2,
      heightReference: HeightReference.RELATIVE_TO_GROUND,
    },
    label: {
      text: "check",
      font: "14pt monospace",
      style: LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      verticalOrigin: VerticalOrigin.BOTTOM,
      pixelOffset: new Cartesian2(0, -9),
      heightReference: HeightReference.RELATIVE_TO_GROUND,
    },
  });
  */
  if (drawFlag == 1) {
    var numFlag = document.getElementById("drawNum").value;
    console.log("numFlag:" + numFlag);
    switch (parseInt(numFlag)) {
      case 0:
        positionCartographic.longitude =
          positionCartographic.longitude + drawSize / 2;
        var number0 = viewer.entities.add({
          name: "0",
          polyline: {
            positions: Cartesian3.fromDegreesArray([
              Math.toDegrees(positionCartographic.longitude),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              drawLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),
            ]),
            width: 5,
            material: Color.RED,
            clampToGround: true,
          },
        });
        // code block
        break;
      case 1:
        var number1 = viewer.entities.add({
          name: "1",
          polyline: {
            positions: Cartesian3.fromDegreesArray([
              Math.toDegrees(positionCartographic.longitude),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),
            ]),
            width: 5,
            material: Color.RED,
            clampToGround: true,
          },
        });
        // code block
        break;
      case 2:
        var number2 = viewer.entities.add({
          name: "2",
          polyline: {
            positions: Cartesian3.fromDegreesArray([
              Math.toDegrees(positionCartographic.longitude),
              Math.toDegrees(positionCartographic.latitude),

              drawHalfLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              drawLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              drawLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),
            ]),
            width: 5,
            material: Color.RED,
            clampToGround: true,
          },
        });
        // code block
        break;
      case 3:
        var number3 = viewer.entities.add({
          name: "3",
          polyline: {
            positions: Cartesian3.fromDegreesArray([
              Math.toDegrees(positionCartographic.longitude),
              Math.toDegrees(positionCartographic.latitude),

              drawHalfLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              drawLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              drawLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),
            ]),
            width: 5,
            material: Color.RED,
            clampToGround: true,
          },
        });
        // code block
        break;
      case 4:
        var number4 = viewer.entities.add({
          name: "4",
          polyline: {
            positions: Cartesian3.fromDegreesArray([
              Math.toDegrees(positionCartographic.longitude),
              Math.toDegrees(positionCartographic.latitude),

              drawHalfLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),
            ]),
            width: 5,
            material: Color.RED,
            clampToGround: true,
          },
        });
        // code block
        break;
      case 5:
        var number5 = viewer.entities.add({
          name: "5",
          polyline: {
            positions: Cartesian3.fromDegreesArray([
              Math.toDegrees(positionCartographic.longitude),
              Math.toDegrees(positionCartographic.latitude),

              drawHalfLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              drawLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              drawLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),
            ]),
            width: 5,
            material: Color.RED,
            clampToGround: true,
          },
        });
        // code block
        break;
      case 6:
        var number6 = viewer.entities.add({
          name: "6",
          polyline: {
            positions: Cartesian3.fromDegreesArray([
              Math.toDegrees(positionCartographic.longitude),
              Math.toDegrees(positionCartographic.latitude),

              drawHalfLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              drawLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),
            ]),
            width: 5,
            material: Color.RED,
            clampToGround: true,
          },
        });
        // code block
        break;
      case 7:
        positionCartographic.latitude =
          positionCartographic.latitude + drawSize;
        positionCartographic.longitude =
          positionCartographic.longitude - drawSize / 2;
        var number7 = viewer.entities.add({
          name: "7",
          polyline: {
            positions: Cartesian3.fromDegreesArray([
              Math.toDegrees(positionCartographic.longitude),
              Math.toDegrees(positionCartographic.latitude),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),
            ]),
            width: 5,
            material: Color.RED,
            clampToGround: true,
          },
        });
        // code block
        break;
      case 8:
        positionCartographic.longitude =
          positionCartographic.longitude - drawSize / 2;
        var number8 = viewer.entities.add({
          name: "8",
          polyline: {
            positions: Cartesian3.fromDegreesArray([
              Math.toDegrees(positionCartographic.longitude),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              drawLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),
            ]),
            width: 5,
            material: Color.RED,
            clampToGround: true,
          },
        });
        // code block
        break;
      case 9:
        positionCartographic.latitude =
          positionCartographic.latitude - drawSize;
        positionCartographic.longitude =
          positionCartographic.longitude - drawSize / 2;
        var number9 = viewer.entities.add({
          name: "9",
          polyline: {
            positions: Cartesian3.fromDegreesArray([
              Math.toDegrees(positionCartographic.longitude),
              Math.toDegrees(positionCartographic.latitude),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              Math.toDegrees(positionCartographic.longitude),
              drawUp(positionCartographic),

              drawLeft(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),

              Math.toDegrees(positionCartographic.longitude),
              drawDown(positionCartographic),

              drawRight(positionCartographic),
              Math.toDegrees(positionCartographic.latitude),
            ]),
            width: 5,
            material: Color.RED,
            clampToGround: true,
          },
        });
        // code block
        break;
      default:
        console.log("Please enter a valid value");
      // code block
    }
  }
}

main();
