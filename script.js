const width = 800;
const height = 600;
const transitionDuration = 1500;

let spikes, legend, subtitle, areas;
let deathsMap = new Map();
let selectedLocation = null;

function zoomed(event) {
  const { transform } = event;
  g.attr("transform", transform);
  g.attr("stroke-width", 1 / transform.k);

  spikes.style("display", transform.k > 1 ? "none" : null);
  legend.style("display", transform.k > 1 ? "none" : null);
  subtitle.style("display", transform.k > 1 ? "none" : null);

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

const svg = d3.select("#map").append("svg")
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
  d3.csv("./deaths_mun.csv"),
  d3.json("./greece-municipalities.json")
]).then(([deathsData, geoData]) => {
  const years = [...new Set(deathsData.map(d => d.year))].sort();

  d3.select("#year-select").selectAll("option")
    .data(years)
    .join("option")
    .text(d => d)
    .attr("value", d => d);

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

  spikes = g.append("g");

  const maxDeaths = d3.max(deathsData, d => +d.deaths);
  const lengthScale = d3.scaleLinear()
    .domain([0, maxDeaths])
    .range([0, 200]);

  function updateMap(selectedYear) {
    document.getElementById('main-title').textContent = `Greece Accident Mortality (${selectedYear})`;
    const filteredData = deathsData.filter(d => d.year === selectedYear);
    deathsMap.clear();
    filteredData.forEach(d => deathsMap.set(d.LEKTIKO, { deaths: +d.deaths, location: d.location }));

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

  updateMap('2022');

  d3.select("#year-select").property("value", "2022");
  d3.select("#year-select").on("change", function() {
    updateMap(this.value);
  });

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
    spikes.style("display", null);
    legend.style("display", null);
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
