"use client";

import { SignOutButton } from "@clerk/nextjs";

export function AdminSignOut() {
  return <SignOutButton redirectUrl="/"><button className="secondary-button" type="button">Sign out</button></SignOutButton>;
}
