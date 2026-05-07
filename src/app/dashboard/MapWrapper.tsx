"use client";

import dynamic from "next/dynamic";
import type { Job } from "@jobtracker/db";

const JobsMap = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-black/40">
      Loading map…
    </div>
  ),
});

export default function MapWrapper({ jobs }: { jobs: Job[] }) {
  return <JobsMap jobs={jobs} />;
}
