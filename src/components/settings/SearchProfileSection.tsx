"use client";

import { useState } from "react";
import {
  GERMANY_PILOT_SEARCH_PROFILE,
  JOB_EMPLOYMENT_TYPES,
  WORKPLACE_TYPES,
} from "@/lib/search-profile";
import type {
  JobEmploymentType,
  JobSearchProfile,
  SearchLocationPreference,
  WorkplaceType,
} from "@/lib/types";
import { INPUT_CLASS, Section } from "./_shared";

const WORKPLACE_LABELS: Record<WorkplaceType, string> = {
  on_site: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};

const EMPLOYMENT_LABELS: Record<JobEmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  working_student: "Working student",
  internship: "Internship",
  contract: "Contract",
  temporary: "Temporary",
  mini_job: "Minijob",
  apprenticeship: "Apprenticeship",
  freelance: "Freelance",
  other: "Other / not specified",
};

function parseCities(value: string): string[] {
  return value
    .split(",")
    .map((city) => city.trim())
    .filter(Boolean);
}

function SelectionButton<T extends string>({
  value,
  selected,
  label,
  onToggle,
}: {
  value: T;
  selected: boolean;
  label: string;
  onToggle: (value: T) => void;
}) {
  return (
    <button
      key={value}
      type="button"
      role="switch"
      aria-checked={selected}
      onClick={() => onToggle(value)}
      className="cursor-pointer rounded-full px-3 py-1.5 text-xs transition-colors"
      style={{
        border: `1px solid ${selected ? "#6366f1" : "#1e1e30"}`,
        background: selected ? "rgba(99,102,241,0.15)" : "transparent",
        color: selected ? "#818cf8" : "#94a3b8",
      }}
    >
      {label}
    </button>
  );
}

export default function SearchProfileSection({
  profile,
  onChange,
}: {
  profile: JobSearchProfile;
  onChange: (profile: JobSearchProfile) => void;
}) {
  const [addingLocation, setAddingLocation] = useState(false);
  const [newCountryCode, setNewCountryCode] = useState("");
  const [newCountryName, setNewCountryName] = useState("");

  function updateLocation(index: number, patch: Partial<SearchLocationPreference>) {
    onChange({
      ...profile,
      locations: profile.locations.map((location, i) =>
        i === index ? { ...location, ...patch } : location,
      ),
    });
  }

  function toggleWorkplaceType(value: WorkplaceType) {
    const next = new Set(profile.workplace_types);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange({ ...profile, workplace_types: Array.from(next) });
  }

  function toggleEmploymentType(value: JobEmploymentType) {
    const next = new Set(profile.employment_types);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange({ ...profile, employment_types: Array.from(next) });
  }

  function addLocation() {
    const countryCode = newCountryCode.trim().toUpperCase();
    const countryName = newCountryName.trim();
    if (!/^[A-Z]{2}$/.test(countryCode) || !countryName) return;

    onChange({
      ...profile,
      locations: [
        ...profile.locations,
        {
          country_code: countryCode,
          country_name: countryName,
          cities: [],
          country_wide: false,
          remote_countrywide: false,
        },
      ],
    });
    setNewCountryCode("");
    setNewCountryName("");
    setAddingLocation(false);
  }

  return (
    <Section title="Search profile">
      <p className="mb-4 text-[13px] leading-relaxed text-[#64748b]">
        Choose where and how you want to work. Empty location or category selections leave that
        filter open. Jobs with uncertain location or type stay visible for review.
      </p>

      <div className="mb-5 space-y-4">
        {profile.locations.map((location, index) => (
          <div
            key={`${location.country_code}-${index}`}
            className="rounded-lg border border-[#1e1e30] p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <strong className="text-sm text-[#e2e8f0]">
                {location.country_name} ({location.country_code})
              </strong>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...profile,
                    locations: profile.locations.filter((_, i) => i !== index),
                  })
                }
                className="text-xs text-[#f87171] hover:underline"
              >
                Remove
              </button>
            </div>
            <label className="mb-3 block text-xs text-[#94a3b8]">
              Cities, separated by commas
              <input
                value={location.cities.join(", ")}
                onChange={(event) =>
                  updateLocation(index, { cities: parseCities(event.target.value) })
                }
                placeholder="Berlin, Munich, Nürnberg"
                className={`${INPUT_CLASS} mt-1`}
              />
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-xs text-[#94a3b8]">
                <input
                  type="checkbox"
                  checked={location.country_wide}
                  onChange={(event) =>
                    updateLocation(index, { country_wide: event.target.checked })
                  }
                  className="mt-0.5 accent-[#6366f1]"
                />
                Include on-site and hybrid roles anywhere in {location.country_name}
              </label>
              <label className="flex items-start gap-2 text-xs text-[#94a3b8]">
                <input
                  type="checkbox"
                  checked={location.remote_countrywide}
                  onChange={(event) =>
                    updateLocation(index, { remote_countrywide: event.target.checked })
                  }
                  className="mt-0.5 accent-[#6366f1]"
                />
                Include remote roles available across {location.country_name}
              </label>
            </div>
          </div>
        ))}
      </div>

      {addingLocation ? (
        <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input
            aria-label="Country code"
            value={newCountryCode}
            onChange={(event) => setNewCountryCode(event.target.value.toUpperCase().slice(0, 2))}
            placeholder="Country code"
            className={INPUT_CLASS}
            maxLength={2}
          />
          <input
            aria-label="Country name"
            value={newCountryName}
            onChange={(event) => setNewCountryName(event.target.value)}
            placeholder="Country name"
            className={INPUT_CLASS}
          />
          <button
            type="button"
            onClick={addLocation}
            disabled={!/^[A-Z]{2}$/.test(newCountryCode.trim()) || !newCountryName.trim()}
            className="rounded-lg border border-[#6366f1] px-3 py-2 text-xs text-[#a5b4fc] disabled:opacity-40"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAddingLocation(false)}
            className="text-left text-xs text-[#64748b] hover:underline sm:col-span-3"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingLocation(true)}
          className="mb-5 rounded-lg border border-[#1e1e30] px-3 py-2 text-xs text-[#a5b4fc] hover:border-[#6366f1]"
        >
          + Add country or region
        </button>
      )}

      <div className="mb-5">
        <h4 className="mb-2 text-xs font-semibold text-[#94a3b8]">Workplace</h4>
        <p className="mb-2 text-[11px] text-[#64748b]">
          Leave all unselected to include any arrangement.
        </p>
        <div className="flex flex-wrap gap-2">
          {WORKPLACE_TYPES.map((value) => (
            <SelectionButton
              key={value}
              value={value}
              label={WORKPLACE_LABELS[value]}
              selected={profile.workplace_types.includes(value)}
              onToggle={toggleWorkplaceType}
            />
          ))}
        </div>
      </div>

      <div className="mb-5">
        <h4 className="mb-2 text-xs font-semibold text-[#94a3b8]">Employment types</h4>
        <p className="mb-2 text-[11px] text-[#64748b]">
          Leave all unselected to include any category.
        </p>
        <div className="flex flex-wrap gap-2">
          {JOB_EMPLOYMENT_TYPES.map((value) => (
            <SelectionButton
              key={value}
              value={value}
              label={EMPLOYMENT_LABELS[value]}
              selected={profile.employment_types.includes(value)}
              onToggle={toggleEmploymentType}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange(structuredClone(GERMANY_PILOT_SEARCH_PROFILE))}
        className="rounded-lg border border-[#1e1e30] px-3 py-2 text-xs text-[#a5b4fc] hover:border-[#6366f1]"
      >
        Use Germany pilot locations and job types
      </button>
    </Section>
  );
}
