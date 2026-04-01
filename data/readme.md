# To make a geojson file

## 1. Use Overpass Turbo (Web Interface)

Go to https://overpass-turbo.eu/

Navigate to the area on the map you want to extract.

Write the following query to find specific features. For example, to find all buildings in the current view:

程式碼片段
[out:json];
(
  way["building"]({{bbox}});
  relation["building"]({{bbox}});
);
out body;
>;
out skel qt;

Run the query and then go to Export > GeoJSON to download the file.

## 2. Use a Python Script (Automated) !!! NOT TESTED YET !!!
If you need to automate this process for many locations, you can use the overpass library in Python:

Python
import overpass

api = overpass.API()
Query for university buildings in a specific bounding box
query = 'way["building"="university"](33.87, -117.89, 33.89, -117.88);'
response = api.get(query, responseformat="geojson")

Save to a file
with open("my_data.geojson", "w") as f:
    import json
    json.dump(response, f)