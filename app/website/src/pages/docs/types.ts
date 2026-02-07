import type { ElementType } from 'react';

export interface DocSubsection {
  id: string;
  title: string;
}

export interface DocSection {
  id: string;
  title: string;
  icon: ElementType;
  subsections?: DocSubsection[];
}

export interface OverviewHighlight {
  icon: ElementType;
  title: string;
  description: string;
}

export interface GettingStartedStep {
  step: number;
  title: string;
  description: string;
  cta?: {
    href: string;
    label: string;
    icon: ElementType;
  };
}

export interface FeatureCard {
  id: string;
  icon: ElementType;
  title: string;
  description: string;
  details: string[];
}

export interface ArchitectureCallout {
  id: string;
  title: string;
  description: string;
  chips?: {
    icon: ElementType;
    label: string;
    className: string;
    iconClassName: string;
  }[];
}

export interface TechStackRow {
  label: string;
  value: string;
}

export interface PackageItem {
  icon: ElementType;
  title: string;
  description: string;
}

export interface PrivacyItem {
  icon: ElementType;
  title: string;
  description: string;
  badgeClassName: string;
  iconClassName: string;
}
