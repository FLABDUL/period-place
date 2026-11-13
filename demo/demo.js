import {
  Map,
  Marker,
  NavigationControl,
  LngLatBounds,
} from "./vendor/maplibre-gl.mjs"

const product = (type, brand, attributes, flow = []) => ({
  type,
  brand,
  attributes,
  flow,
})
const venues = [
  {
    id: "riverside",
    name: "Riverside Library",
    city: "Glasgow",
    nation: "Scotland",
    kind: "Library",
    point: [-4.27, 55.865],
    confidence: "venue-confirmed",
    products: [
      product(
        "Pads",
        "Demo Cotton",
        ["Disposable", "Fragrance-free"],
        ["Regular", "Heavy"],
      ),
      product(
        "Tampons",
        "Demo Cotton",
        ["Organic cotton", "Disposable"],
        ["Regular"],
      ),
    ],
    latest: "Recently available",
    access:
      "Sample access: a self-service basket beside the accessible toilet.",
    visits: 3,
  },
  {
    id: "meadow",
    name: "Meadow Community Hub",
    city: "Edinburgh",
    nation: "Scotland",
    kind: "Community centre",
    point: [-3.2, 55.95],
    confidence: "scheme-confirmed",
    products: [
      product("Pads", null, ["Disposable"], ["Regular"]),
      product("Reusable pads", "Demo Reuse", ["Reusable"]),
      product("Menstrual cups", "Demo Reuse", ["Reusable"]),
    ],
    latest: "Recently low stock",
    access: "Sample access: ask the welcome desk during opening hours.",
    visits: 2,
  },
  {
    id: "orchard",
    name: "Orchard Learning Centre",
    city: "Glasgow",
    nation: "Scotland",
    kind: "School or college",
    point: [-4.24, 55.85],
    confidence: "community-reported",
    products: [
      product("Pads", null, ["Disposable"], ["Night / extra-heavy"]),
      product("Period pants", "Demo Reuse", ["Reusable"]),
    ],
    latest: "No visits yet",
    access:
      "Sample access: visitors ask at reception for the collection point.",
    visits: 0,
  },
  {
    id: "harbour",
    name: "Harbour Neighbourhood Centre",
    city: "Belfast",
    nation: "Northern Ireland",
    kind: "Community centre",
    point: [-5.93, 54.6],
    confidence: "venue-confirmed",
    products: [
      product("Reusable pads", "Demo Reuse", ["Reusable"]),
      product("Period pants", "Demo Reuse", ["Reusable"]),
    ],
    latest: "Recently available",
    access:
      "Sample access: reusable products are available by request at reception.",
    visits: 4,
  },
  {
    id: "willow",
    name: "Willow Library",
    city: "Manchester",
    nation: "England",
    kind: "Library",
    point: [-2.25, 53.48],
    confidence: "scheme-confirmed",
    products: [
      product(
        "Pads",
        "Demo Cotton",
        ["Disposable", "Fragrance-free"],
        ["Heavy"],
      ),
      product("Tampons", null, ["Disposable"], ["Regular"]),
    ],
    latest: "Recently empty",
    access:
      "Sample access: products normally sit in a marked cabinet in the foyer.",
    visits: 1,
  },
  {
    id: "cedar",
    name: "Cedar Wellbeing Centre",
    city: "Bristol",
    nation: "England",
    kind: "Public venue",
    point: [-2.59, 51.45],
    confidence: "venue-confirmed",
    products: [
      product("Menstrual cups", "Demo Reuse", ["Reusable"]),
      product(
        "Pads",
        "Demo Cotton",
        ["Organic cotton", "Disposable"],
        ["Regular"],
      ),
    ],
    latest: "Recently available",
    access: "Sample access: speak to a member of the reception team.",
    visits: 2,
  },
  {
    id: "fern",
    name: "Fern Community Library",
    city: "Dundee",
    nation: "Scotland",
    kind: "Library",
    point: [-2.97, 56.46],
    confidence: "scheme-confirmed",
    products: [
      product("Tampons", null, ["Disposable"], ["Regular"]),
      product("Pads", null, ["Disposable"], ["Regular"]),
    ],
    latest: "No visits yet",
    access:
      "Sample access: a free collection basket is beside the information desk.",
    visits: 0,
  },
  {
    id: "quay",
    name: "Quay Advice Centre",
    city: "Belfast",
    nation: "Northern Ireland",
    kind: "Public venue",
    point: [-5.91, 54.61],
    confidence: "community-reported",
    products: [product("Pads", null, ["Disposable"], ["Regular"])],
    latest: "Recently low stock",
    access: "Sample access: ask an adviser about the collection point.",
    visits: 1,
  },
]
const evidence = {
  "venue-confirmed": [
    "Venue confirmed",
    "The sample venue has confirmed these product types. Sizes, brands and current stock can still vary.",
  ],
  "scheme-confirmed": [
    "Scheme confirmed",
    "The sample scheme offers these products, but the exact range at this individual venue has not been checked.",
  ],
  "community-reported": [
    "Community report",
    "A sample moderated community report describes this location. Independent venue confirmation is still needed.",
  ],
}
const main = document.querySelector("main")
const state = {
  query: "",
  type: new Set(),
  brand: new Set(),
  attribute: new Set(),
  flow: new Set(),
  availability: new Set(),
  sort: false,
  selected: null,
}
const reports = []
const visits = new globalThis.Map()
let map = null
let pins = []
let lastRoute = ""
function node(tag, text, cls) {
  const el = document.createElement(tag)
  if (text !== undefined && text !== null) el.textContent = text
  if (cls) el.className = cls
  return el
}
function link(text, hash, cls) {
  const a = node("a", text, cls)
  a.href = hash
  return a
}
function button(text, action, cls = "secondary-button") {
  const b = node("button", text, cls)
  b.type = "button"
  b.onclick = action
  return b
}
const latest = v => visits.get(v.id)?.at(-1)?.availability || v.latest
const namedBrands = () =>
  venues.filter(v => v.products.some(p => p.brand)).length
const warning =
  '<p class="demo-summary"><strong>Fictional demonstration.</strong> Names, map pins, brands, stock and reports are invented. Do not travel to these sample locations.</p>'

function home() {
  main.innerHTML = `<section class="hero landing-hero"><div class="hero-copy"><p class="eyebrow">Free products · community knowledge</p><h1>Find free period products near you</h1><p class="hero-intro">Search free period products across the UK, check what the evidence actually confirms, and see recent moderated visits before you travel.</p><p class="hero-caveat">Exact products and stock can change. Period Place shows uncertainty instead of guessing.</p><div class="hero-actions"><a class="primary-button" href="#find">Find free products</a><a class="text-link" href="#report">Report what you found →</a></div><p class="status">Explore with fictional demo data. The original service is retired.</p></div><aside class="proof-card"><p class="proof-kicker">Built around real needs</p><p class="proof-brand">Free products. Clear evidence.</p><p>Official sources establish provision. Recent community reports help keep it useful between updates.</p><div class="proof-rule"></div><p><strong>Specific when we can be.</strong><br>Brands and product details appear only when evidence supports them.</p></aside></section><section class="trust-strip" aria-label="Sample data coverage"><p><span>${venues.length}</span><strong>Sample locations</strong><small>Fictional records for this demo</small></p><p><span>3/4</span><strong>UK nations represented</strong><small>A coverage gap is shown openly</small></p><p><span>${namedBrands()}</span><strong>With a sample brand</strong><small>Unknown details remain unknown</small></p></section><section class="landing-steps"><p class="eyebrow">How it works</p><h2>Useful before you set off.</h2><div class="step-grid"><article><span>1</span><h3>Search</h3><p>Try a place, product type, brand or material preference.</p></article><article><span>2</span><h3>Check the evidence</h3><p>Inspect the location details and recent moderated visitor reports.</p></article><article><span>3</span><h3>Help the next person</h3><p>Submit a sample report, then review it in the demo moderation queue.</p></article></div></section><section class="landing-coverage"><div><p class="eyebrow">Coverage, with its limits</p><h2>See where the map has weight.</h2><p>A blank area means we have no records in the sample dataset. It does not mean free products are unavailable.</p></div><div class="hero-actions"><a class="primary-button" href="#find">Open the finder</a><a class="text-link" href="#coverage">View coverage and sources →</a></div></section>`
}

function matching() {
  const q = state.query.trim().toLowerCase()
  return venues
    .filter(
      v =>
        (
          v.name +
          " " +
          v.city +
          " " +
          v.nation +
          " " +
          v.products
            .map(p => [p.type, p.brand, ...p.attributes, ...p.flow].join(" "))
            .join(" ")
        )
          .toLowerCase()
          .includes(q) &&
        (!state.availability.size || state.availability.has(latest(v))) &&
        v.products.some(
          p =>
            (!state.type.size || state.type.has(p.type)) &&
            (!state.brand.size ||
              state.brand.has(p.brand || "Brand not confirmed")) &&
            (!state.attribute.size ||
              [...state.attribute].every(a => p.attributes.includes(a))) &&
            (!state.flow.size || p.flow.some(f => state.flow.has(f))),
        ),
    )
    .sort((a, b) =>
      state.sort
        ? Math.hypot(a.point[0] + 4.25, a.point[1] - 55.86) -
          Math.hypot(b.point[0] + 4.25, b.point[1] - 55.86)
        : 0,
    )
}
function reset() {
  state.query = ""
  ;["type", "brand", "attribute", "flow", "availability"].forEach(k =>
    state[k].clear(),
  )
  state.sort = false
  state.selected = null
  finder()
}
function finder() {
  main.innerHTML = `<section class="finder-intro"><p class="eyebrow">Free period products · sample UK coverage</p><h1>Find products near you.</h1><p>Search by place, product or brand. Filter what matters, then check the evidence.</p>${warning}</section><section class="finder-shell" aria-labelledby="finder-title"><div class="finder-topline"><div><p class="eyebrow">Community map</p><h2 id="finder-title">Find products that suit you</h2></div><p class="result-count" id="count" role="status"></p></div><div class="search-row"><label class="search-box"><span aria-hidden="true">⌕</span><span class="visually-hidden">Search locations, products or brands</span><input id="search" placeholder="Place, product or brand" type="search"></label><button type="button" class="secondary-button" id="sort">Try location sorting</button></div><p class="status" id="search-status" role="status"></p><div class="filter-panel"><div class="filter-heading"><div><strong>Filter the evidence</strong><small>Different filter groups combine to narrow results.</small></div><button type="button" class="text-button" id="clear">Clear search and filters</button></div><div id="facets"></div></div><div class="finder-grid"><div class="results" id="results" aria-label="Matching locations"></div><div class="map-wrap"><div class="map" id="map" role="region" aria-label="Interactive map of fictional sample locations"></div><p class="map-status" id="map-status" role="status"></p><p class="map-caption">Fictional pins · use the list for full accessible details</p></div></div><p class="map-access-note">Map tiles: © OpenStreetMap contributors. No directions are provided for fictional venues.</p></section>`
  document.querySelector("#search").value = state.query
  document.querySelector("#search").oninput = e => {
    state.query = e.target.value
    updateResults()
  }
  document.querySelector("#clear").onclick = reset
  document.querySelector("#sort").onclick = () => {
    state.sort = !state.sort
    updateResults()
  }
  const products = venues.flatMap(v => v.products)
  const facets = [
    ["Product type", "type", products.map(p => p.type)],
    ["Brand", "brand", products.map(p => p.brand || "Brand not confirmed")],
    [
      "Materials and preferences",
      "attribute",
      products.flatMap(p => p.attributes),
    ],
    ["Flow / absorbency", "flow", products.flatMap(p => p.flow)],
    ["Latest moderated visit", "availability", venues.map(latest)],
  ]
  for (const [label, key, values] of facets) {
    const field = node("fieldset", null, "facet-group")
    field.append(node("legend", label))
    const row = node("div", null, "filter-row")
    ;[...new Set(values)].forEach(value => {
      const b = button(
        value,
        () => {
          if (state[key].has(value)) state[key].delete(value)
          else state[key].add(value)
          b.setAttribute("aria-pressed", String(state[key].has(value)))
          updateResults()
        },
        "filter",
      )
      b.setAttribute("aria-pressed", String(state[key].has(value)))
      row.append(b)
    })
    field.append(row)
    document.querySelector("#facets").append(field)
  }
  if (map) map.remove()
  map = null
  pins = []
  try {
    map = new Map({
      container: "map",
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [-3.4, 54.8],
      zoom: 5,
      cooperativeGestures: true,
      attributionControl: { compact: false },
    })
    map.addControl(new NavigationControl(), "top-right")
    map.on("error", () => {
      const status = document.querySelector("#map-status")
      if (status)
        status.textContent =
          "Map tiles are unavailable. Search and all location details still work in the list."
    })
    map.on("zoomend", () => {
      const el = document.querySelector("#map")
      if (el) el.dataset.zoom = String(map.getZoom())
    })
  } catch {
    document.querySelector("#map-status").textContent =
      "Your browser cannot display the map. All sample locations are available in the list."
  }
  updateResults()
}
function updateResults() {
  const matches = matching()
  document.querySelector("#count").textContent =
    `${matches.length} matching / ${venues.length} sample locations`
  document.querySelector("#search-status").textContent = state.sort
    ? "Sorted from a sample position in central Glasgow. Your actual location is not requested."
    : "Filters apply to the same product offering. Stock and evidence are fictional."
  const list = document.querySelector("#results")
  list.replaceChildren()
  if (!matches.length) {
    const box = node("div", null, "empty-state")
    box.append(
      node("h3", "No matching locations yet"),
      node("p", "Try clearing a filter or changing your search."),
      button("Clear search and filters", reset, "text-button"),
    )
    list.append(box)
  }
  matches.forEach(v => {
    const card = node("article", null, "location-card")
    card.id = "venue-" + v.id
    const heading = node("div", null, "card-heading")
    const title = node("div")
    title.append(
      node("p", `${v.city}, ${v.nation} · ${v.kind}`, "city-label"),
      node("h3", v.name),
    )
    heading.append(
      title,
      node("span", evidence[v.confidence][0], "confidence " + v.confidence),
    )
    card.append(
      heading,
      node("p", "Fictional sample venue — not a real collection point"),
      node("p", latest(v) + " · sample evidence", "availability-line"),
    )
    const chips = node("div", null, "chips")
    v.products.forEach(p =>
      chips.append(
        node(
          "span",
          p.type + " · " + (p.brand || "brand not confirmed"),
          "product-chip",
        ),
      ),
    )
    const actions = node("div", null, "card-actions")
    actions.append(
      link("Details and visits", "#location/" + v.id),
      button("Show on map", () => select(v), "text-button"),
    )
    card.append(chips, actions)
    list.append(card)
  })
  pins.forEach(p => p.remove())
  pins = []
  if (map && matches.length) {
    const bounds = new LngLatBounds()
    matches.forEach(v => {
      const b = button(
        String(venues.indexOf(v) + 1),
        () => select(v),
        "demo-pin",
      )
      b.setAttribute(
        "aria-label",
        `${venues.indexOf(v) + 1}: Show ${v.name} on map`,
      )
      b.dataset.venue = v.id
      pins.push(new Marker({ element: b }).setLngLat(v.point).addTo(map))
      bounds.extend(v.point)
    })
    map.fitBounds(bounds, { padding: 60, maxZoom: 11, duration: 0 })
  }
  state.selected = null
}
function select(v) {
  state.selected = v.id
  document
    .querySelectorAll(".location-card")
    .forEach(card =>
      card.classList.toggle("selected", card.id === "venue-" + v.id),
    )
  const card = document.querySelector("#venue-" + v.id)
  card?.scrollIntoView({ block: "nearest", behavior: "auto" })
  pins.forEach(pin =>
    pin
      .getElement()
      .classList.toggle("selected", pin.getElement().dataset.venue === v.id),
  )
  if (map)
    map.easeTo({
      center: v.point,
      zoom: Math.max(map.getZoom(), 9),
      duration: 0,
    })
  document.querySelector("#search-status").textContent =
    `${v.name} selected. Open “Details and visits” to inspect its evidence.`
}

function detail(id) {
  const v = venues.find(v => v.id === id)
  if (!v) {
    main.innerHTML =
      '<section class="page-shell"><h1>Sample location not found</h1><a href="#find">Back to finder</a></section>'
    return
  }
  main.innerHTML = `<section class="page-shell"><a class="text-link" href="#find">← Back to finder</a><p class="eyebrow">${v.city}, ${v.nation} · ${evidence[v.confidence][0]}</p><h1>${v.name}</h1>${warning}<p>${evidence[v.confidence][1]}</p><section class="panel"><h2>What you may find</h2><ul class="product-list">${v.products.map(p => `<li><p class="product-summary"><strong>${p.type}</strong> · ${p.brand || "Brand not confirmed"}</p><p>${p.attributes.join(" · ")}${p.flow.length ? " · Flow: " + p.flow.join(", ") : ""}</p><small>Sample ${v.confidence === "venue-confirmed" ? "venue" : "scheme or community"} evidence. This is not a real product or stock claim.</small></li>`).join("")}</ul></section><section class="panel community-panel"><p class="eyebrow">Recent community evidence</p><h2>${v.visits + (visits.get(v.id)?.length || 0)} sample moderated visits</h2><p class="availability-banner">${latest(v)} · fictional report</p><div class="rating-grid"><p><strong>${v.visits ? "4/5" : "—"}</strong><span>Sample listing accuracy</span></p><p><strong>${v.visits ? "5/5" : "—"}</strong><span>Sample ease of access</span></p><p><strong>${v.visits ? "4/5" : "—"}</strong><span>Sample privacy and dignity</span></p></div><ul class="visit-comments" id="visit-comments"></ul></section><section class="panel"><h2>Why we show this</h2><ul class="source-list"><li><strong>Fictional ${evidence[v.confidence][0].toLowerCase()} evidence</strong><p>${evidence[v.confidence][1]}</p><small>Illustrative evidence dated 12 November 2026. No real council endorsement is implied.</small></li></ul><p><strong>Access:</strong> ${v.access}</p></section><section class="panel"><h2>Help the next person know what to expect.</h2><p>Try a stock update or correction. Then review it in the demo moderation queue.</p><a class="primary-button inline-button" href="#report/${v.id}">Report a visit or correction</a></section></section>`
  const comments = document.querySelector("#visit-comments")
  if (v.visits)
    comments.append(
      node(
        "li",
        "Example comment: “The collection point was easy to find.” — fictional visitor",
      ),
    )
  for (const r of visits.get(v.id) || [])
    comments.append(
      node("li", r.availability + (r.comment ? " — " + r.comment : "")),
    )
}

function coverage() {
  main.innerHTML = `<section class="page-shell coverage-page"><p class="eyebrow">Coverage and sources</p><h1>Know what the map covers.</h1>${warning}<p>These counts describe this demonstration only. The retired production service had a separate, much larger dataset.</p><div class="coverage-stats"><p><strong>8</strong><span>Sample locations</span></p><p><strong>3/4</strong><span>Nations represented</span></p><p><strong>${namedBrands()}</strong><span>With a sample brand</span></p><p><strong>1</strong><span>Illustrated coverage gap</span></p></div><h2>Coverage by nation</h2><div class="nation-grid">${[
    "Scotland",
    "England",
    "Northern Ireland",
    "Wales",
  ]
    .map(n => {
      const count = venues.filter(v => v.nation === n).length
      return `<p class="${count ? "" : "gap"}"><strong>${n}</strong><span>${count ? count + " fictional locations" : "No sample records — a deliberate coverage gap"}</span></p>`
    })
    .join(
      "",
    )}</div><p class="coverage-fallback">No records does not mean no provision. Coverage gaps are shown openly rather than filled with guesses.</p><label class="coverage-search">Find a sample coverage area<input id="coverage-search" placeholder="Try Glasgow"></label><div class="coverage-table"><div class="coverage-row coverage-heading"><span>Area</span><span>Nation</span><span>Sample locations</span></div><div id="coverage-rows"></div></div><section class="panel"><h2>Three kinds of evidence</h2>${Object.values(
    evidence,
  )
    .map(([label, explanation]) => `<h3>${label}</h3><p>${explanation}</p>`)
    .join("")}</section></section>`
  const render = () => {
    const q = document.querySelector("#coverage-search").value.toLowerCase()
    const rows = document.querySelector("#coverage-rows")
    rows.replaceChildren()
    ;[...new Set(venues.map(v => v.city))]
      .filter(city => city.toLowerCase().includes(q))
      .forEach(city => {
        const group = venues.filter(v => v.city === city)
        const row = node("div", null, "coverage-row")
        row.append(
          node("strong", city),
          node("span", group[0].nation),
          node("span", String(group.length)),
        )
        rows.append(row)
      })
    if (!rows.children.length)
      rows.append(node("p", "No sample coverage areas match."))
  }
  document.querySelector("#coverage-search").oninput = render
  render()
}

function report(id) {
  main.innerHTML = `<section class="page-shell narrow-page"><p class="eyebrow">Community knowledge</p><h1>Report what you found.</h1><p>A submitted report enters moderation before it changes a listing. Try the complete flow using the sample venues.</p>${warning}<form class="panel form-grid" id="report-form"><label class="full-field">Sample venue<select name="venue" required>${venues.map(v => `<option value="${v.id}">${v.name} · ${v.city}</option>`).join("")}</select></label><label>Report type<select name="kind"><option>Stock update</option><option>Access correction</option><option>Product correction</option></select></label><label>What did you find?<select name="availability"><option>Recently available</option><option>Recently low stock</option><option>Recently empty</option><option>Could not find products</option></select></label><label class="full-field">Details for the moderator<textarea name="comment" maxlength="500" placeholder="Optional fictional details — please do not enter personal information"></textarea></label><p class="form-note">Nothing is sent to a server. Reports live only in this page’s memory until you reload it.</p><button class="primary-button" type="submit">Submit demo report</button></form><div id="report-status" role="status"></div></section>`
  const form = document.querySelector("#report-form")
  if (venues.some(v => v.id === id)) form.elements.venue.value = id
  form.onsubmit = e => {
    e.preventDefault()
    const data = new FormData(form)
    reports.push({
      id: reports.length + 1,
      venue: String(data.get("venue")),
      kind: String(data.get("kind")),
      availability: String(data.get("availability")),
      comment: String(data.get("comment")).trim(),
      status: "Pending",
    })
    form.reset()
    form.elements.venue.value = String(data.get("venue"))
    const status = document.querySelector("#report-status")
    status.replaceChildren(
      node(
        "p",
        "Demo report received — pending moderator review. The listing has not changed.",
        "action-message success",
      ),
      link(
        "Review this report in demo moderation →",
        "#moderation",
        "text-link",
      ),
    )
  }
}

function moderation() {
  main.innerHTML = `<section class="page-shell admin-page"><p class="eyebrow">Demo review workspace</p><h1>Review before publishing.</h1><p>This illustrates the original protected moderation workflow. No account is needed here because all records and actions are fictional and local to your browser tab.</p><div class="admin-stats"><p><strong>${reports.filter(r => r.status === "Pending").length}</strong><span>Pending review</span></p><p><strong>${reports.filter(r => r.status === "Approved").length}</strong><span>Approved reports</span></p><p><strong>${reports.filter(r => r.status === "Rejected").length}</strong><span>Rejected reports</span></p></div><section class="panel"><h2>Review queue</h2><div id="queue"></div></section><div class="demo-tools"><a class="primary-button" href="#report">Create a sample report</a><button class="secondary-button" id="reset-reports">Reset demo reports</button></div><p class="status" role="status">Approved stock updates appear in the sample location’s visitor evidence. Corrections remain labelled as moderator notes.</p></section>`
  const queue = document.querySelector("#queue")
  if (!reports.length)
    queue.append(
      node(
        "p",
        "No reports yet. Submit a demo report to try approving or rejecting it.",
      ),
    )
  reports.forEach(r => {
    const v = venues.find(v => v.id === r.venue)
    const item = node("article", null, "queue-item")
    item.append(
      node("h3", `Report ${r.id} · ${v.name}`),
      node("p", `${r.kind} · ${r.availability} · ${r.status}`),
    )
    if (r.comment) item.append(node("p", r.comment))
    if (r.status === "Pending") {
      const actions = node("div", null, "moderation-actions")
      actions.append(
        button(
          "Approve report " + r.id,
          () => {
            r.status = "Approved"
            if (r.kind === "Stock update") {
              const current = visits.get(v.id) || []
              visits.set(v.id, [...current, r])
            }
            moderation()
          },
          "approve-button",
        ),
        button(
          "Reject report " + r.id,
          () => {
            r.status = "Rejected"
            moderation()
          },
          "reject-button",
        ),
      )
      item.append(actions)
    } else
      item.append(
        node(
          "p",
          r.status === "Approved"
            ? r.kind === "Stock update"
              ? "Audit: approved in this demo session; sample visitor evidence updated."
              : "Audit: approved as a moderator note; underlying location facts have not been rewritten."
            : "Audit: rejected in this demo session; public sample evidence unchanged.",
        ),
      )
    item.append(
      link("View location evidence →", "#location/" + v.id, "text-link"),
    )
    queue.append(item)
  })
  document.querySelector("#reset-reports").onclick = () => {
    reports.length = 0
    visits.clear()
    moderation()
  }
}

function feedback() {
  main.innerHTML = `<section class="page-shell narrow-page"><p class="eyebrow">Feedback</p><h1>Was this useful?</h1><p>Explore the original feedback flow. This demonstration does not deliver or store feedback.</p><form id="feedback-form" class="panel form-grid"><label class="full-field">How useful was the finder?<select required><option value="">Choose a rating</option><option>5 — Very useful</option><option>4 — Useful</option><option>3 — Neutral</option><option>2 — Not very useful</option><option>1 — Not useful</option></select></label><label class="full-field">Did you find what you needed?<select><option>Yes</option><option>Partly</option><option>No</option></select></label><label class="full-field">What would you improve?<textarea maxlength="500" placeholder="Fictional feedback only; do not enter personal information"></textarea></label><button class="primary-button" type="submit">Try feedback submission</button></form><p id="feedback-status" role="status"></p></section>`
  document.querySelector("#feedback-form").onsubmit = e => {
    e.preventDefault()
    e.target.reset()
    document.querySelector("#feedback-status").textContent =
      "Demo complete. No feedback was sent or saved."
  }
}
function about() {
  main.innerHTML = `<section class="page-shell"><p class="eyebrow">About the demonstration</p><h1>Free products. Clear evidence.</h1><p>Period Place was built to help people find period products while making evidence quality and coverage gaps clear. This demonstration restores the original visual design, homepage, finder and moderation flow for technical and design review.</p>${warning}<section class="panel"><h2>What works here</h2><p>Search, combined product filters, the interactive map, location details, sample coverage, feedback forms and the report → review → published evidence flow. Light and dark themes work across all views.</p><h2>What is simulated</h2><p>Every venue, brand, stock claim and visitor comment is fictional. Map coordinates place illustrative pins near real cities; they are not directions to services. Location sorting uses a sample position in Glasgow. Submissions and moderation exist only in this tab’s memory and disappear on reload. No sign-in, payment or backend service is connected.</p></section><section class="panel"><h2>The original product</h2><p>The live service is retired. Its original homepage screenshot and launch findings remain in the case study.</p><a class="primary-button inline-button" href="https://www.madebyhakim.com/projects/period-place/">View original website and case study</a> <a class="text-link" href="https://github.com/FLABDUL/period-place">Explore public source ↗</a></section><section class="panel"><h2>Map and software credits</h2><p>Interactive mapping uses MapLibre GL JS. Map data and tiles: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>. Tiles load from OpenStreetMap when you open the finder; that provider receives the normal web request. If tiles cannot load, the location list and details remain available.</p><p><a href="vendor/LICENSE.txt">MapLibre licence</a> · <a href="fonts/dmsans-OFL.txt">DM Sans font licence</a> · <a href="fonts/fraunces-OFL.txt">Fraunces font licence</a></p></section></section>`
}

function route() {
  const hash = location.hash.slice(1) || "home"
  const [view, id] = hash.split("/")
  if (map) {
    map.remove()
    map = null
    pins = []
  }
  document.querySelector(".nav-menu").open = false
  ;(
    ({
      home,
      find: finder,
      coverage,
      location: () => detail(id),
      report: () => report(id),
      moderation,
      feedback,
      about,
    })[view] || home
  )()
  document.querySelectorAll("header nav a").forEach(a => {
    if (a.hash === "#" + view) a.setAttribute("aria-current", "page")
    else a.removeAttribute("aria-current")
  })
  document.title = `${view === "home" ? "Period Place" : view.charAt(0).toUpperCase() + view.slice(1) + " · Period Place"} · Demo`
  if (lastRoute) {
    main.focus()
    window.scrollTo(0, 0)
  }
  lastRoute = hash
}
document.querySelector(".skip-link").onclick = event => {
  event.preventDefault()
  main.focus()
  main.scrollIntoView({ block: "start" })
}
document.querySelector("#theme").disabled = false
document.querySelector("#theme").onclick = () => {
  const dark = document.documentElement.dataset.theme === "dark"
  document.documentElement.dataset.theme = dark ? "light" : "dark"
  document.querySelector("#theme").textContent = dark ? "☾ Dark" : "☀ Light"
}
window.addEventListener("hashchange", route)
route()
