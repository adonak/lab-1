//declare map variable globally so all functions have access
var mapUsaPrecip;
var minValue;

//create map
function createMap(){

    //create the map
    mapUsaPrecip = L.map('mapUsaPrecip', {
        center: [39.50, -98.35],
        zoom: 4
    });

    //add base tilelayer
    // uses Stadia AlidadeSmooth map
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', {
	minZoom: 0,
	maxZoom: 20,
	attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	ext: 'png'
	}).addTo(mapUsaPrecip);

    //call getData function
    getData(mapUsaPrecip);
};

function calculateMinValue(data){
    //create empty array to store all data values
    var allValues = [];
    //loop through each city
    for(var NAME of data.features){
        //loop through each year
        for(var year = 2015; year <= 2022; year+=1){
              //get temp for current year
              var value = NAME.properties["PRCP_"+ String(year)];
              allValues.push(value)
        }
    }
    //get minimum value of array
    var minValue = Math.min(...allValues)

    return minValue;
}

//calculate radius of each proportional symbol
function calcPropRadius(attValue) {
    //constant factor adjusts symbol sizes evenly
    var minRadius = 8;
    //Flannery Apperance Compensation formula
    var radius = 1.0083 * Math.pow(Number(attValue)/minValue,0.5715) * Number(minRadius)

    return radius;
};

// function to create pop-up-content object
function PopupContent(properties, attribute){
    this.properties = properties;
    this.attribute = attribute;
    this.year = attribute.split("_")[1];
    this.PRCP = this.properties[attribute];
    this.formatted = "<p><b>Weather Station:</b> " + this.properties.NAME + "</p><p><b>Annual Precipitation, " + this.year + ":</b> " + this.PRCP + " inches</p>";
};

//function to convert markers to circle markers
function pointToLayer(feature, latlng, attributes){
    //Determine which attribute to visualize with proportional symbols
    var attribute = attributes[0];

    //create marker options
    var options = {
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };

    //For each feature, determine its value for the selected attribute
    var attValue = Number(feature.properties[attribute]);

    //Give each feature's circle marker a radius based on its attribute value
    options.radius = calcPropRadius(attValue);

    //create circle marker layer
    var layer = L.circleMarker(latlng, options);

    //create new popup content
    var popupContent = new PopupContent(feature.properties, attribute);

    //bind the popup to the circle marker    
    layer.bindPopup(popupContent.formatted, { 
        offset: new L.Point(0,-options.radius)
    });


    //return the circle marker to the L.geoJson pointToLayer option
    return layer;
};


//Add circle markers for point features to the map
function createPropSymbols(data, attributes){
    //create a Leaflet GeoJSON layer and add it to the map
    L.geoJson(data, {
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, attributes);
        }
    }).addTo(mapUsaPrecip);
};

//Create new sequence controls
function createSequenceControls(attributes){   
    var SequenceControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },

        onAdd: function () {
            // create the control container div with a particular class name
            var container = L.DomUtil.create('div', 'sequence-control-container');

            //create range input element (slider)
            container.insertAdjacentHTML('beforeend', '<input class="range-slider" type="range">')

            //set slider attributes
            container.querySelector(".range-slider").max = 6;
            container.querySelector(".range-slider").min = 0;
            container.querySelector(".range-slider").value = 0;
            container.querySelector(".range-slider").step = 1;

            //add skip buttons
            container.insertAdjacentHTML('beforeend', '<button class="step" id="reverse" title="Reverse"><img src="img/reverse.svg"></button>'); 
            container.insertAdjacentHTML('beforeend', '<button class="step" id="forward" title="Forward"><img src="img/forward.svg"></button>');

            //disable any mouse event listeners for the container
            L.DomEvent.disableClickPropagation(container);

            return container;
        }

    });

    mapUsaPrecip.addControl(new SequenceControl());   

    // click listener for buttons
    document.querySelectorAll('.step').forEach(function(step){
        step.addEventListener("click", function(){
            var index = document.querySelector('.range-slider').value;

            //increment or decrement depending on button clicked
            if (step.id == 'forward'){
                index++;
                // if past the last attribute, wrap around to first attribute
                index = index > 6 ? 0 : index;
            } else if (step.id == 'reverse'){
                index--;
                // if past the first attribute, wrap around to last attribute
                index = index < 0 ? 6 : index;
            };

            //update slider
            document.querySelector('.range-slider').value = index;

            // pass new attribute to update symbols
            updatePropSymbols(attributes[index]);

            // update legend as well
            updateLegend(attributes[index]);
        })

    })

    // input listener for slider
    document.querySelector('.range-slider').addEventListener('input', function(){            
        var index = this.value;
        // pass new attribute to update symbols
        updatePropSymbols(attributes[index]);
        // update legend as well
        updateLegend(attributes[index]);  
    });
};

// build attributes array from data
function processData(data){
    //empty array to hold attributes
    var attributes = [];

    //properties of the first feature in the dataset
    var properties = data.features[0].properties;

    //push each attribute name into attributes array
    for (var attribute in properties){
        //only take attributes with avg temp values
        if (attribute.indexOf("PRCP") > -1){
            attributes.push(attribute);
        };
    };

    return attributes;
};

//Resize proportional symbols according to new attribute values
function updatePropSymbols(attribute){
    mapUsaPrecip.eachLayer(function(layer){
        if (layer.feature && layer.feature.properties[attribute]){
            //access feature properties
            var props = layer.feature.properties;

            //update each feature's radius based on new attribute values
            var radius = calcPropRadius(props[attribute]);
            layer.setRadius(radius);

            //add city to popup content string
            var popupContent = new PopupContent(props, attribute);

            //update popup with new content    
            popup = layer.getPopup();    
            popup.setContent(popupContent.formatted).update();
        };
    });
};

function LegendContent(attribute){
    this.year = attribute.split("_")[1];
    this.formatted = '<p class="legend-content"><b>Annual Precipitation in <span class="year">2015</span></b></p>';
};

// create legend
function createLegend(attributes){
    var LegendControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },

        onAdd: function () {
            // create the control container with a particular class name
            var container = L.DomUtil.create('div', 'legend-container');

            var attribute = attributes[0]
            legendContent = new LegendContent(attribute)

            container.innerHTML= '<p class="legend-content"><b>Annual Precipitation in <span class="year">2015</span></b></p>';

            return container;
        }
    });
    mapUsaPrecip.addControl(new LegendControl());
};

function updateLegend(attribute){
    var year = attribute.split("_")[1];
    // update legend
    document.querySelector("span.year").innerHTML = year;
};


//Import GeoJSON data
function getData(){
    //load the data
    fetch("data/dataUsaPrecip.geojson")
        .then(function(response){
            return response.json();
        })
        .then(function(json){
            // create attribute array
            var attributes = processData(json);
            //calculate minimum data value
            minValue = calculateMinValue(json);
            //call function to create proportional symbols
            createPropSymbols(json, attributes);
            // call function to create legend
            createLegend(attributes);
            // call function to create slider control
            createSequenceControls(attributes);
        })
};

document.addEventListener('DOMContentLoaded',createMap)