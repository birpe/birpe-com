import React from "react";

type LiquidGlassLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: React.ReactNode;
  tone?: "light" | "dark";
};

type LiquidGlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: React.ReactNode;
  tone?: "light" | "dark";
};

type LiquidGlassPillProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "light" | "dark";
};

function GlassLayers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span className="liquid-glass__distortion" aria-hidden="true" />
      <span className="liquid-glass__tint" aria-hidden="true" />
      <span className="liquid-glass__shine" aria-hidden="true" />
      <span className="liquid-glass__content">{children}</span>
    </>
  );
}

export function LiquidGlassFilter() {
  return (
    <svg className="liquid-glass-filter" aria-hidden="true">
      <filter
        id="birpe-liquid-glass"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.001 0.005"
          numOctaves="1"
          seed="17"
          result="turbulence"
        />
        <feComponentTransfer in="turbulence" result="mapped">
          <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
          <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
          <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
        </feComponentTransfer>
        <feGaussianBlur in="mapped" stdDeviation="3" result="softMap" />
        <feSpecularLighting
          in="softMap"
          surfaceScale="5"
          specularConstant="1"
          specularExponent="100"
          lightingColor="white"
          result="specLight"
        >
          <fePointLight x="-200" y="-200" z="300" />
        </feSpecularLighting>
        <feComposite
          in="specLight"
          operator="arithmetic"
          k1="0"
          k2="1"
          k3="1"
          k4="0"
          result="litImage"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softMap"
          scale="200"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}

export function LiquidGlassLink({
  children,
  className = "",
  tone = "dark",
  ...props
}: LiquidGlassLinkProps) {
  return (
    <a {...props} className={`liquid-glass liquid-glass--${tone} ${className}`.trim()}>
      <GlassLayers>{children}</GlassLayers>
    </a>
  );
}

export function LiquidGlassButton({
  children,
  className = "",
  tone = "dark",
  type = "button",
  ...props
}: LiquidGlassButtonProps) {
  return (
    <button {...props} type={type} className={`liquid-glass liquid-glass--${tone} ${className}`.trim()}>
      <GlassLayers>{children}</GlassLayers>
    </button>
  );
}

export function LiquidGlassPill({
  children,
  className = "",
  tone = "dark",
  ...props
}: LiquidGlassPillProps) {
  return (
    <span {...props} className={`liquid-glass liquid-glass--${tone} ${className}`.trim()}>
      <GlassLayers>{children}</GlassLayers>
    </span>
  );
}
