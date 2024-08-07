const width = 800;
const height = 600;
const transitionDuration = 1500;
let selectedMap = "Municipalities"

// Create tooltip
const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

function createMap(mapId, titleId, region, fileCSV, fileJSON, updateMapFunction) {
  let spikes, legend, subtitle, areas;
  let deathsMap = new Map();
  let selectedLocation = null;

  function zoomed(event) {
    const { transform } = event;
    g.attr("transform", transform);
    g.attr("stroke-width", 1 / transform.k);

    spikes?.style("display", transform.k > 1 ? "none" : null);
    legend?.style("display", transform.k > 1 ? "none" : null);
    subtitle?.style("display", transform.k > 1 ? "none" : null);

    selectedTitle.style("display", transform.k > 1 && selectedLocation ? null : "none");
    selectedSubtitle.style("display", transform.k > 1 && selectedLocation ? null : "none");

    if (transform.k === 1) {
      areas.style("fill", null).style("opacity", 1);
      selectedLocation = null;
    }
  }

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", zoomed);

  const svg = d3.select(mapId).append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(zoom);

  const g = svg.append("g");

  const selectedTitle = svg.append("text")
    .attr("x", width / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .style("font", "20px sans-serif")
    .style("fill", "#8B0000")
    .style("display", "none");

  const selectedSubtitle = svg.append("text")
    .attr("x", width / 2)
    .attr("y", 55)
    .attr("text-anchor", "middle")
    .style("font", "16px sans-serif")
    .style("fill", "#8B0000")
    .style("display", "none");

  svg.append("defs")
    .append("filter")
    .attr("id", "glow")
    .append("feGaussianBlur")
    .attr("stdDeviation", "2.5")
    .attr("result", "coloredBlur");

  Promise.all([
    d3.csv(fileCSV),
    d3.json(fileJSON)
  ]).then(([deathsData, geoData]) => {
    const years = [...new Set(deathsData.map(d => d.year))].sort();

    if (!d3.select("#year-select").selectAll("option").size()) {
      d3.select("#year-select").selectAll("option")
        .data(years)
        .join("option")
        .text(d => d)
        .attr("value", d => d);
    }

    const projection = d3.geoMercator()
      .fitSize([width, height], geoData);

    const path = d3.geoPath().projection(projection);

    areas = g.selectAll(".area")
      .data(geoData.features)
      .join("path")
      .attr("class", "area")
      .attr("d", path)
      .attr("fill", d => {
        const colorPalette = ['#B0B0B0', '#A0A0A0', '#909090'];
        return colorPalette[Math.floor(Math.random() * colorPalette.length)];
      })
      .on("click", clicked);

    // Add tooltip functionality for map-1 and map-2 areas
    areas.on("mouseover", function(event, d) {
      if (d3.zoomTransform(svg.node()).k === 1) { // Show tooltip only when zoom level is 1
        const locationData = deathsMap.get(d.properties.LEKTIKO);
        if (locationData) {
          tooltip.transition()
            .duration(200)
            .style("opacity", .9);
          tooltip.html(`<strong>${locationData.location}</strong><br/>Deaths: ${locationData.deaths}`)
            .style("left", (event.pageX + 5) + "px")
            .style("top", (event.pageY - 28) + "px");
        }
      }
    })
    .on("mouseout", function() {
      tooltip.transition()
        .duration(500)
        .style("opacity", 0);
    });

    spikes = g.append("g");

    const maxDeaths = d3.max(deathsData, d => +d.deaths);
    const lengthScale = d3.scaleLinear()
      .domain([0, maxDeaths])
      .range([0, 200]);

    function updateMap(selectedYear) {
      document.getElementById(titleId).textContent = `Road Accidents Mortality by ${selectedMap}`;
      document.getElementById("general-title").textContent = `Road Accidents Mortality in Greece (${selectedYear})`;
      const filteredData = deathsData.filter(d => d.year === selectedYear);
      deathsMap.clear();
      filteredData.forEach(d => deathsMap.set(d.LEKTIKO, { deaths: +d.deaths, location: d.location }));

      if (mapId === "#map-1") {
        const volcanoes = spikes.selectAll("g.volcano")
          .data(filteredData, d => d.LEKTIKO)
          .join(
            enter => {
              const g = enter.append("g").attr("class", "volcano");

              g.append("path")
                .attr("class", "volcano-spike")
                .attr("transform", d => {
                  const feature = geoData.features.find(f => f.properties.LEKTIKO === d.LEKTIKO);
                  if (!feature || !feature.geometry || !feature.geometry.coordinates) return null;
                  const centroid = path.centroid(feature);
                  const [x, y] = centroid;
                  return `translate(${x}, ${y})`;
                })
                .attr("d", d => `M-5,0 Q0,-${lengthScale(deathsMap.get(d.LEKTIKO).deaths)} 5,0`)
                .append("title")
                .text(d => `${deathsMap.get(d.LEKTIKO).location}: ${deathsMap.get(d.LEKTIKO).deaths} deaths`);

              return g;
            },
            update => update.call(update => {
              update.select(".volcano-spike")
                .transition()
                .duration(transitionDuration)
                .attr("transform", d => {
                  const feature = geoData.features.find(f => f.properties.LEKTIKO === d.LEKTIKO);
                  if (!feature || !feature.geometry || !feature.geometry.coordinates) return null;
                  const centroid = path.centroid(feature);
                  const [x, y] = centroid;
                  return `translate(${x}, ${y})`;
                })
                .attr("d", d => `M-5,0 Q0,-${lengthScale(deathsMap.get(d.LEKTIKO).deaths)} 5,0`);
              return update;
            }),
            exit => exit.transition().duration(transitionDuration).remove()
          );
      } else {
        const color = d3.scaleQuantize()
          .domain([0, maxDeaths])
          .range(d3.schemeReds[9]);

        areas.attr("fill", d => {
          const deaths = deathsMap.get(d.properties.LEKTIKO)?.deaths || 0;
          return color(deaths);
        });

        if (!legend) {
          legend = svg.append("g")
            .attr("transform", `translate(${width - 680}, ${height - 220})`);

          const legendScale = d3.scaleLinear()
            .domain([0, maxDeaths])
            .range([0, 200]);

          const legendAxis = d3.axisRight(legendScale)
            .ticks(6)
            .tickSize(13)
            .tickFormat(d => d3.format(".0f")(d));

          legend.append("g")
            .attr("class", "legend-axis")
            .call(legendAxis);

          legend.select(".legend-axis")
            .select(".domain")
            .remove();

          const legendRects = legend.selectAll("rect")
            .data(color.range().map(d => {
              const extent = color.invertExtent(d);
              if (!extent[0]) extent[0] = legendScale.domain()[0];
              if (!extent[1]) extent[1] = legendScale.domain()[1];
              return extent;
            }))
            .enter().append("rect")
            .attr("x", 0)
            .attr("y", d => legendScale(d[0]))
            .attr("width", 8)
            .attr("height", d => legendScale(d[1]) - legendScale(d[0]))
            .attr("fill", d => color(d[0]));
        }
      }

      if (selectedLocation) {
        const locationData = deathsMap.get(selectedLocation.LEKTIKO);
        if (locationData) {
          selectedTitle.text(locationData.location).style("display", null);
          selectedSubtitle.text(`${locationData.deaths} deaths`).style("display", null);
        } else {
          selectedTitle.style("display", "none");
          selectedSubtitle.style("display", "none");
        }
      }
    }

    updateMapFunction(updateMap);

    d3.select("#year-select").property("value", "2022");

    if (mapId === "#map-1") {
      legend = svg.append("g")
        .attr("fill", "#8B0000")
        .attr("transform", `translate(${width - 680}, ${height - 30})`)
        .attr("text-anchor", "middle")
        .style("font", "10px sans-serif")
        .selectAll("g")
        .data(lengthScale.ticks(4).slice(1))
        .join("g")
        .attr("transform", (d, i) => `translate(${20 * i},0)`);

      legend.append("path")
        .attr("fill", "#8B0000")
        .attr("fill-opacity", 0.5)
        .attr("stroke", "#8B0000")
        .attr("stroke-width", 0.5)
        .attr("d", d => `M-5,0 Q0,-${lengthScale(d)} 5,0`);

      legend.append("text")
        .attr("dy", "1.5em")
        .text(lengthScale.tickFormat(4, "s"));
    }

    subtitle = svg.append("text")
      .attr("x", width - 650)
      .attr("y", height)
      .attr("text-anchor", "middle")
      .style("font", "12px sans-serif")
      .style("fill", "#8B0000")
      .text("No. of Deaths");

    function reset() {
      areas.transition().style("fill", null).style("opacity", 1);
      svg.transition().duration(1000).call(
        zoom.transform,
        d3.zoomIdentity,
        d3.zoomTransform(svg.node()).invert([width / 2, height / 2])
      );
      spikes?.style("display", null);
      legend?.style("display", null);
      subtitle.style("display", null);
      selectedTitle.style("display", "none");
      selectedSubtitle.style("display", "none");
      selectedLocation = null;
    }

    function clicked(event, d) {
      const [[x0, y0], [x1, y1]] = path.bounds(d);
      event.stopPropagation();
      areas.transition().style("fill", null).style("opacity", 1);
      d3.select(this).transition().style("fill", "red").style("opacity", 0.5);
      svg.transition().duration(1000).call(
        zoom.transform,
        d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(Math.min(8, 0.9 / Math.max((x1 - x0) / width, (y1 - y0) / height)))
          .translate(-(x0 + x1) / 2, -(y0 + y1) / 2),
        d3.pointer(event, svg.node())
      );

      selectedLocation = d.properties;

      const selectedYear = d3.select("#year-select").property("value");
      const locationData = deathsMap.get(d.properties.LEKTIKO);
      if (locationData) {
        selectedTitle.text(locationData.location).style("display", null);
        selectedSubtitle.text(`${locationData.deaths} deaths`).style("display", null);
      }
    }

    svg.on("click", reset);
  })
  .catch(error => console.error('Error loading data:', error));
}

function updateAllMaps(updateMap1, updateMap2) {
  d3.select("#year-select").on("change", function() {
    const selectedYear = this.value;
    updateMap1(selectedYear);
    updateMap2(selectedYear);
    updateChartData(selectedYear);
  });
}

let updateMap1, updateMap2;


createMap("#map-1", "main-title", "Municipalities", "./deaths_mun.csv", "./greece-municipalities.json", function(updateMapFunction) {
  updateMap1 = updateMapFunction;
  updateMap1("2022");
});

createMap("#map-2", "main-title", "Regional Units", "./deaths_reg.csv", "./greece-regional-units.json", function(updateMapFunction) {
  updateMap2 = updateMapFunction;
  updateMap2("2022");
});

updateAllMaps(
  (year) => updateMap1 && updateMap1(year),
  (year) => updateMap2 && updateMap2(year)
);

d3.selectAll('input[name="map-toggle"]').on("change", function() {
  selectedMap = this.value;
  const selectedYear = d3.select("#year-select").property("value");
  if (selectedMap === "Municipalities") {
    d3.select("#map-1").style("display", null);
    d3.select("#map-2").style("display", "none");
    d3.select("#main-title").text(`Road Accidents Mortality by Municipalities`);
  } else {
    d3.select("#map-1").style("display", "none");
    d3.select("#map-2").style("display", null);
    d3.select("#main-title").text(`Road Accidents Mortality by Regional Units`);
  }
});

async function loadData() {
  // Load the CSV file
  const data = await d3.csv("deaths_age_veh.csv");

  // Process the data into the required format
  const ageColumns = data.columns.slice(1, -1); // Skip the 'vehicles' and 'year' columns
  const processedData = ageColumns.flatMap(age => 
      data.map(d => ({ state: d.vehicles, age, population: +d[age], year: +d.year }))
  );

  return processedData;
}

function updateChart(data, year) {
  const margin = {top: 60, right: 150, bottom: 60, left: 60}; // Adjusted for axis legends and title
  const width = 960 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  // Filter data by selected year
  const filteredData = data.filter(d => d.year === +year);

  // Extract unique age groups
  const ageGroups = Array.from(new Set(filteredData.map(d => d.age)));

  // Group data by state and age
  const nestedData = d3.group(filteredData, d => d.state);

  // Convert nested data to the format required by d3.stack
  const stackData = Array.from(nestedData, ([key, values]) => {
      const obj = { state: key };
      values.forEach(v => {
          obj[v.age] = v.population;
      });
      // Calculate the total population for sorting
      obj.totalPopulation = d3.sum(values, v => v.population);
      return obj;
  });

  // Sort stackData by total population
  stackData.sort((a, b) => b.totalPopulation - a.totalPopulation);

  // Set up stack generator
  const stack = d3.stack()
      .keys(ageGroups)
      (stackData);

  // Set up scales
  const x = d3.scaleBand()
      .domain(stackData.map(d => d.state))
      .range([0, width])
      .padding(0.1);

  const y = d3.scaleLinear()
      .domain([0, d3.max(stack, d => d3.max(d, d => d[1]))])
      .nice()
      .range([height, 0]);

  // Define a custom color scale from white to grey to red
  const color = d3.scaleLinear()
      .domain([0, ageGroups.length / 2, ageGroups.length - 1])
      .range(["#ffffff", "#808080", "#ff0000"]);

  // Create a color mapping for age groups
  const ageGroupColor = ageGroups.reduce((acc, age, index) => {
      acc[age] = color(index);
      return acc;
  }, {});

  // Clear previous chart
  d3.select("#chart").selectAll("*").remove();

  // Create the SVG container
  const svg = d3.select("#chart").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

  const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  // Add title
  svg.append("text")
      .attr("x", (width + margin.left + margin.right) / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("font-size", 28)
      .attr("font-weight", "bold")
      .text(`Mortality by Age and Type of Vehicle`);

  // Add X axis
  g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("font-size", "14px");

  // X axis legend
  g.append("text")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 10)
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("font-size", 16)
      .text("Vehicles");

  // Add Y axis
  g.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .attr("font-size", "14px");

  // Y axis legend
  g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -margin.left + 20)
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("font-size", 16)
      .text("Number of Deaths");

  const stackGroups = g.append("g")
    .selectAll("g")
    .data(stack)
    .enter().append("g")
    .attr("fill", d => ageGroupColor[d.key]);

  const rects = stackGroups.selectAll("rect")
    .data(d => d);

  // Enter selection
  rects.enter().append("rect")
    .attr("x", d => x(d.data.state))
    .attr("y", d => y(0))
    .attr("height", 0)
    .attr("width", x.bandwidth())
    .merge(rects)
    .transition()
    .duration(1200)
    .attr("x", d => x(d.data.state))
    .attr("y", d => y(d[1]))
    .attr("height", d => y(d[0]) - y(d[1]))
    .attr("width", x.bandwidth());

  // Exit selection
  rects.exit().remove();
  
  // Add a legend
  const legend = svg.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 14)
      .attr("text-anchor", "end")
      .attr("transform", `translate(${width + margin.left + 40}, ${margin.top})`); // Move legend to the right

  legend.selectAll("g")
    .data(ageGroups.slice().reverse())
    .enter().append("g")
      .attr("transform", (d, i) => `translate(0,${i * 20})`)
    .each(function(d) {
        const g = d3.select(this);
        g.append("rect")
            .attr("x", -19)
            .attr("width", 19)
            .attr("height", 19)
            .attr("fill", ageGroupColor[d]);
        g.append("text")
            .attr("x", -24)
            .attr("y", 9.5)
            .attr("dy", "0.32em")
            .text(d);
    });

  // Add subtitle below the legend
  svg.append("text")
      .attr("x", width + margin.left + 40)
      .attr("y", margin.top + ageGroups.length * 20 + 10)
      .attr("text-anchor", "end")
      .attr("font-family", "sans-serif")
      .attr("font-size", 16)
      .text("Age (years)");
}

let chartData;

function updateChartData(selectedYear) {
  if (!chartData) {
    loadData().then(data => {
      chartData = data;
      updateChart(chartData, selectedYear);
    }).catch(error => {
      console.error('Error loading or processing data:', error);
    });
  } else {
    updateChart(chartData, selectedYear);
  }
}

updateChartData(2022); 
