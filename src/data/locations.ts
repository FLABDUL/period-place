import type { PeriodLocation } from "@/types/location";

// Fictional fixtures only: coordinates illustrate layout, not service provision.
export const locations: PeriodLocation[] = [
  {slug:"demo-riverside",name:"Demo Riverside Library",city:"Sampletown",nation:"Scotland",adminArea:"Fictional district",address:"Fictional venue — do not travel here",postcode:"",latitude:55.86,longitude:-4.25,venueType:"Library",access:"Demo: self-service basket by the accessible toilet.",confidence:"venue-confirmed",products:[{type:"Pads",brand:null,attributes:["Disposable"],evidence:"Fictional venue confirmation."},{type:"Tampons",brand:null,attributes:["Disposable"],evidence:"Fictional venue confirmation."}],sources:[{label:"Fictional demo evidence",url:"https://example.com",checked:"13 November 2026",scope:"Synthetic data, not a real service."}]},
  {slug:"demo-meadow",name:"Demo Meadow Community Hub",city:"Sampletown",nation:"Scotland",adminArea:"Fictional district",address:"Fictional venue — do not travel here",postcode:"",latitude:55.87,longitude:-4.27,venueType:"Community centre",access:"Demo: ask at reception.",confidence:"scheme-confirmed",products:[{type:"Reusable pads",brand:null,attributes:["Reusable"],evidence:"Fictional scheme-level evidence."}],sources:[{label:"Fictional demo evidence",url:"https://example.com",checked:"13 November 2026",scope:"Synthetic data, not a real service."}]},
];
export const officialLocationCount = locations.length;
export const getLocation = (slug: string) => locations.find(location => location.slug === slug);
