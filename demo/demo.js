const venues = [
  {
    name: "Riverside Library",
    area: "Riverside",
    type: "Library",
    products: ["Pads", "Tampons"],
    confidence: "Venue-confirmed example",
    access: "Self-service basket beside the accessible toilet.",
    evidence:
      "A fictional venue confirmation names these product types. Live stock remains unknown.",
    x: 18,
    y: 30,
  },
  {
    name: "Meadow Community Hub",
    area: "Meadow",
    type: "Community centre",
    products: ["Pads", "Reusable pads", "Menstrual cups"],
    confidence: "Scheme-confirmed example",
    access: "Ask at the welcome desk during opening hours.",
    evidence:
      "A fictional scheme lists these products, but availability at this individual venue has not been checked.",
    x: 65,
    y: 42,
  },
  {
    name: "Orchard Learning Centre",
    area: "Orchard",
    type: "School or college",
    products: ["Pads", "Tampons", "Period pants"],
    confidence: "Community-reported example",
    access: "Reception can direct visitors to the collection point.",
    evidence:
      "A fictional moderated report describes this collection point. Independent venue confirmation is still needed.",
    x: 32,
    y: 70,
  },
  {
    name: "Harbour Neighbourhood Centre",
    area: "Harbour",
    type: "Community centre",
    products: ["Reusable pads", "Period pants"],
    confidence: "Venue-confirmed example",
    access: "Reusable products are available by request at reception.",
    evidence:
      "A fictional venue confirmation identifies reusable products. Sizes and current stock are not guaranteed.",
    x: 76,
    y: 76,
  },
]
const selectedTypes = new Set()
const search = document.querySelector("#search")
const results = document.querySelector("#results")
const markers = document.querySelector("#markers")
const detail = document.querySelector("#detail")
const filters = document.querySelector("#filters")
function element(tag, text, className) {
  const e = document.createElement(tag)
  if (text) e.textContent = text
  if (className) e.className = className
  return e
}
function showVenue(v) {
  detail.replaceChildren(
    element("span", v.confidence, "badge"),
    element("h2", v.name),
    element("p", v.area + " · " + v.type),
    element("h3", "Access"),
    element("p", v.access),
    element("h3", "Products"),
    element("p", v.products.join(", ")),
    element("h3", "What the evidence says"),
    element("p", v.evidence),
    element(
      "p",
      "Fictional demonstration only. No real venue or stock is represented.",
    ),
  )
  detail.focus()
  document.querySelector("#venue").value = v.name
}
function render() {
  const q = search.value.trim().toLowerCase()
  const matches = venues.filter(
    v =>
      (v.name + " " + v.area + " " + v.products.join(" "))
        .toLowerCase()
        .includes(q) &&
      (!selectedTypes.size || v.products.some(p => selectedTypes.has(p))),
  )
  results.replaceChildren()
  markers.replaceChildren()
  detail.replaceChildren(
    element("h2", "Select a venue"),
    element("p", "Open a card or map marker to inspect its evidence."),
  )
  document.querySelector("#count").textContent =
    matches.length + " matching sample venues"
  if (!matches.length)
    results.append(
      element(
        "p",
        "No sample venues match. Try clearing your search or filters.",
      ),
    )
  matches.forEach(v => {
    const index = venues.indexOf(v) + 1
    const card = element("article", null, "card")
    card.append(
      element("span", v.confidence, "badge"),
      element("h3", v.name),
      element("p", v.area + " · " + v.type),
      element("p", v.products.join(" · ")),
    )
    const button = element("button", "View " + v.name)
    button.onclick = () => showVenue(v)
    card.append(button)
    results.append(card)
    const marker = element("button", String(index))
    marker.style.left = v.x + "%"
    marker.style.top = v.y + "%"
    marker.setAttribute("aria-label", "Show " + v.name + " on map")
    marker.onclick = () => showVenue(v)
    markers.append(marker)
  })
}
;[...new Set(venues.flatMap(v => v.products))].forEach(type => {
  const b = element("button", type)
  b.type = "button"
  b.setAttribute("aria-pressed", "false")
  b.onclick = () => {
    if (selectedTypes.has(type)) selectedTypes.delete(type)
    else selectedTypes.add(type)
    b.setAttribute("aria-pressed", String(selectedTypes.has(type)))
    render()
  }
  filters.append(b)
})
venues.forEach(v => {
  const o = element("option", v.name)
  o.value = v.name
  document.querySelector("#venue").append(o)
})
search.oninput = render
document.querySelector("#reset").onclick = () => {
  search.value = ""
  selectedTypes.clear()
  filters
    .querySelectorAll("button")
    .forEach(b => b.setAttribute("aria-pressed", "false"))
  render()
}
document.querySelector("#report").onsubmit = e => {
  e.preventDefault()
  document.querySelector("#report-status").textContent =
    "Demo report for " +
    document.querySelector("#venue").value +
    ": pending moderator review. Nothing was sent or saved."
}
render()
document.querySelectorAll("[disabled]").forEach(e => (e.disabled = false))
