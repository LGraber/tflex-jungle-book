"use strict";

var gFilterList;

function getElem(elementId) {
    return document.getElementById(elementId);
}

function removeShape(shapeId) {
    const shape = getElem(shapeId);
    if (null != shape) {
        getElem('svg-root').removeChild(shape);
        return true;
    }
    return false;
}

function createShapeStart(x, y) {
    const c = document.createElementNS("http://www.w3.org/2000/svg", 'circle')
    c.id = "shape-start";
    c.setAttribute('cx', x);
    c.setAttribute('cy', y);
    c.setAttribute('r', 2);
    c.style.fill = "red";
    getElem('svg-root').appendChild(c);
}

function createTempPolyLine(x, y) {
    const tempShape = document.createElementNS("http://www.w3.org/2000/svg", 'polyline');
    tempShape.id = "temp-shape";
    tempShape.classList.add("outline");
    tempShape.setAttribute('points', x + "," + y);
    getElem('svg-root').appendChild(tempShape);
    return tempShape;
}

function applyShapeFilter(event){
    event.stopPropagation();
    var shiftKey = event.shiftKey;
    let updateType = shiftKey ? tableau.FilterUpdateType.Add : tableau.FilterUpdateType.Replace;
    var filterValue = event.currentTarget.getAttribute('title');
    const worksheetIndex = getElem('sheet-names').selectedIndex;
    tableau.addIn.dashboardContent.dashboard.worksheets[worksheetIndex].applyFilterAsync(
        getElem('filter-fields').value,
        [filterValue],
        updateType
    ).then( (fieldName) => {
        // Let's apply css to the polygon to show it was selected. Unapply for anyone else
        const polygons = getElem('svg-root').getElementsByTagNameNS("http://www.w3.org/2000/svg", 'polygon');
        for (let i=0; i<polygons.length; ++i) {
            if (polygons[i].getAttribute('title') == filterValue) {
                polygons[i].classList.add('active-filter');
            } else if (!shiftKey) {
                polygons[i].classList.remove('active-filter');
            }
        }
    }, (err) => {
        alert(" applyFilterAsync Failed: " + err.toString());
    } );
    
}

function createSavedPolygon(points, val, hide) {
    const shape = document.createElementNS("http://www.w3.org/2000/svg", 'polygon');
    shape.classList.add("filter");
    shape.setAttribute('points', points);
    shape.setAttribute('title', val);
    shape.setAttribute('onclick', "applyShapeFilter(event);");
    if (hide) {
        shape.classList.add('hidden-filter');
    }
    getElem('svg-root').appendChild(shape);
    
}

function saveShape(e) {
    const tempShape = getElem('temp-shape');
    if (null != tempShape) {
        createSavedPolygon(tempShape.getAttribute('points'), getElem('filter-domain').value, false);
        getElem('svg-root').removeChild(tempShape);
    }
    removeShape('shape-start');
    $('#field-modal').modal('hide');
}

function deleteShape(e) {
    if (removeShape('shape-start')) {
        removeShape('temp-shape');
    } else {
        svgRoot = getElem('svg-root');
        if (null != svgRoot.lastElementChild) {
            svgRoot.removeChild(svgRoot.lastElementChild);
        }
    }
}

function completeShape(e) {
    e.preventDefault();
    const shapeStart = getElem('shape-start');
    if (null != shapeStart) {
        // Let's draw the last line. Should make sure you have more than just the start
        addVertex({'pageX': shapeStart.getAttribute('cx'), 'pageY': shapeStart.getAttribute('cy') }); 
        $('#field-modal').modal('show');
    }
    return false;
}

function addVertex(e) {
    const shapeStart = getElem('shape-start');
    if (null == shapeStart) {
        createShapeStart(e.pageX, e.pageY);
    } else {
        let tempShape = getElem('temp-shape');
        if (null == tempShape) {
            tempShape = createTempPolyLine(shapeStart.getAttribute('cx'), shapeStart.getAttribute('cy'));
        }
        // Add the next point
        let points = tempShape.getAttribute('points');
        points += " " + e.pageX + "," + e.pageY;
        tempShape.setAttribute('points', points);
    }
}

function deleteVertex() {
    const tempShape = getElem('temp-shape');
    if (null != tempShape) {
        let points = tempShape.getAttribute('points');
        // Remove the last point
        points = points.substring(0, points.lastIndexOf(" "));
        if (-1 == points.indexOf(" ")) {
            // If there is only one point left, remove the temp shape
            getElem('svg-root').removeChild(tempShape);
        } else {
            tempShape.setAttribute('points', points);
        }
    } else {
        removeShape('shape-start');
    }
}

function updateFilterFields(e) {
    let selectedFilter = null;
    if ((null != e) && typeof(e) == 'string') {
        // this is the saved value
        selectedFilter = e;
    }
    let worksheetIndex = getElem('sheet-names').selectedIndex;
    tableau.addIn.dashboardContent.dashboard.worksheets[worksheetIndex].getFiltersAsync().then( 
        function(filters) {
            getElem('filter-fields').removeEventListener('change', updateFilterDomain);
            for(const filter of filters) {
                let opt = document.createElement('option');
                opt.value = opt.text = filter.fieldName;
                if (selectedFilter == filter.fieldName) {
                    opt.setAttribute('selected', 'selected');
                }
                getElem('filter-fields').appendChild(opt);
            }
            gFilterList = filters;
            getElem('filter-fields').addEventListener('change', updateFilterDomain);
            // Populate the initial fieldDomain
            updateFilterDomain();
        }, function(err) {
            alert("getFiltersAsync failed: " + err.toString());
        });
}

function updateFilterDomain() {
    let filterIndex = getElem('filter-fields').selectedIndex ;
    gFilterList[filterIndex].getDomainAsync().then(
        function(domain) {
            for(const val of domain.values) {
                let opt= document.createElement('option');
                opt.value = opt.text = val.value;
                getElem('filter-domain').appendChild(opt);
            }
        }
    )
}

function updateSettings() {
    getElem('mapped-image').src = getElem("image-url").value;
    $('#settings-modal').modal('hide');
}

function saveAll() {
    // Save the Image Url, SheetName, FilterName, and {points, value} list
    tableau.addIn.settings.set('imageUrl', getElem('image-url').value);
    tableau.addIn.settings.set('sheetName', getElem('sheet-names').value);
    tableau.addIn.settings.set('filterName', getElem('filter-fields').value);
    const polygons = getElem('svg-root').getElementsByTagNameNS("http://www.w3.org/2000/svg", 'polygon');
    for (let i=0; i<polygons.length; ++i) {
        tableau.addIn.settings.set('polygon' + i + "Value", polygons[i].getAttribute('title'));
        tableau.addIn.settings.set('polygon' + i + 'Points', polygons[i].getAttribute('points'));
    }
    tableau.addIn.settings.saveAsync().then( function() {
        console.log("settings saved");
    }, function(err) {
        console.log("saveAsync failed: " + err.toString());
    });


}

function clearFilters() {
    const worksheetIndex = getElem('sheet-names').selectedIndex;
    const fieldName = getElem('filter-fields').value;
    tableau.addIn.dashboardContent.dashboard.worksheets[worksheetIndex].applyFilterAsync(
        fieldName,
        [],
        tableau.FilterUpdateType.All
    ).then( (fieldName) => {
        // make sure nothing is marked as active
        const polygons = getElem('svg-root').getElementsByTagNameNS("http://www.w3.org/2000/svg", 'polygon');
        for (let i=0; i<polygons.length; ++i) {
            polygons[i].classList.remove('active-filter');
        }
    }, (err) => {
        alert(" applyFilterAsync Failed: " + err.toString());
    } );
}

function onGearClicked() {
    let hidden = getElem('edit-buttons').classList.toggle('hidden');
    getElem('selection-div').classList.toggle('hidden');
    if (!hidden) {
        // show all of the shapes
        const polygons = getElem('svg-root').children;
        for (let i=0; i<polygons.length; ++i) {
            polygons[i].classList.remove('hidden-filter');
        }
    } else {
        // Delete the start and temp shapes if they exist
        removeShape('shape-start');
        removeShape('temp-shape');
        // hide all of the shapes
        const polygons = getElem('svg-root').children;
        for (let i=0; i<polygons.length; ++i) {
            polygons[i].classList.add('hidden-filter');
        }
    }
}

function onBodyLoad() {  
    getElem('selection-div').addEventListener('click', addVertex);  
    getElem('selection-div').addEventListener('contextmenu', completeShape);

    tableau.addIn.initializeAsync().then( function() {
            const selectedSheet = tableau.addIn.settings.get('sheetName');
            let allSheets = tableau.addIn.dashboardContent.dashboard.worksheets;
            for (const sheet of allSheets) {
                let opt = document.createElement('option');
                opt.value = opt.text = sheet.name;
                if (sheet.name == selectedSheet) {
                    opt.setAttribute('selected', 'selected');
                }
                getElem('sheet-names').appendChild(opt);
            }
            
            getElem('sheet-names').addEventListener('change', updateFilterFields);
            // Populate the initial set of filter fields;
            updateFilterFields();
            // Read any saved polygons
            for( let i=0; i<100; i++) {
                // loop until we don't find anymore
                const polyValue = tableau.addIn.settings.get('polygon' + i + 'Value');
                if (null != polyValue) {
                    const polyPoints = tableau.addIn.settings.get('polygon' + i + 'Points');
                    createSavedPolygon(polyPoints, polyValue, true);
                } else {
                    break;
                }
            }
            const imageUrl = tableau.addIn.settings.get('imageUrl');
            if (null != imageUrl) {
                getElem('mapped-image').src = imageUrl;
                getElem('image-url').value = imageUrl;
            } else {
                // We need the image so lets show the dialog. Also switch to edit mode
                onGearClicked();
                $('#settings-modal').modal('show');
            }

        }, function(err) {
            alert("initializeAsync failed: " + err.toString());
        });
}