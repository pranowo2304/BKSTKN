import React from 'react';

interface AppIconProps {
  className?: string;
  size?: number | string;
  withBackground?: boolean;
}

export const AppIcon: React.FC<AppIconProps> = ({
  className = '',
  size = 40,
  withBackground = true,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="aiBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#022c22" />
          <stop offset="50%" stopColor="#064e3b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        <linearGradient id="aiGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>

        <linearGradient id="aiEmeraldShield" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>

        <linearGradient id="aiHandLeft" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="60%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#a7f3d0" />
        </linearGradient>

        <linearGradient id="aiHandRight" x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#047857" />
          <stop offset="60%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>

        <linearGradient id="aiHeartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="40%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>

      {withBackground && (
        <>
          <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="url(#aiBgGrad)" />
          <rect x="18" y="18" width="476" height="476" rx="110" ry="110" fill="none" stroke="#34d399" strokeWidth={3} strokeOpacity={0.3} />
          <rect x="26" y="26" width="460" height="460" rx="102" ry="102" fill="none" stroke="url(#aiGoldGrad)" strokeWidth={2} strokeOpacity={0.25} />
        </>
      )}

      {/* Outer Protective Ring */}
      <circle cx="256" cy="256" r="160" fill="none" stroke="#10b981" strokeWidth={3.5} strokeDasharray="8 6" strokeOpacity={0.35} />
      <circle cx="256" cy="256" r="148" fill="#042f2e" fillOpacity={0.6} stroke="url(#aiGoldGrad)" strokeWidth={2.5} strokeOpacity={0.5} />

      {/* Laurels */}
      <g fill="url(#aiGoldGrad)" opacity={0.85}>
        <path d="M 170 330 C 160 310 150 280 152 245 C 153 235 142 238 140 248 C 137 285 148 320 162 342 Z" />
        <ellipse cx="145" cy="225" rx="8" ry="16" transform="rotate(-30 145 225)" />
        <ellipse cx="152" cy="190" rx="7" ry="15" transform="rotate(-15 152 190)" />
        <ellipse cx="170" cy="160" rx="7" ry="14" transform="rotate(5 170 160)" />
        <ellipse cx="196" cy="138" rx="6" ry="13" transform="rotate(25 196 138)" />
        <path d="M 342 330 C 352 310 362 280 360 245 C 359 235 370 238 372 248 C 375 285 364 320 350 342 Z" />
        <ellipse cx="367" cy="225" rx="8" ry="16" transform="rotate(30 367 225)" />
        <ellipse cx="360" cy="190" rx="7" ry="15" transform="rotate(15 360 190)" />
        <ellipse cx="342" cy="160" rx="7" ry="14" transform="rotate(-5 342 160)" />
        <ellipse cx="316" cy="138" rx="6" ry="13" transform="rotate(-25 316 138)" />
      </g>

      {/* Protective Shield */}
      <path
        d="M 256 120 C 295 145 330 150 350 155 C 350 240 330 310 256 365 C 182 310 162 240 162 155 C 182 150 217 145 256 120 Z"
        fill="url(#aiEmeraldShield)"
        fillOpacity={0.22}
        stroke="url(#aiEmeraldShield)"
        strokeWidth={3}
        strokeOpacity={0.7}
      />

      {/* Caring Hands */}
      <g>
        <path
          d="M 165 305 C 175 285 198 275 220 288 C 235 297 248 312 256 325 C 246 332 232 338 215 338 C 192 338 172 324 165 305 Z"
          fill="url(#aiHandLeft)"
        />
        <path
          d="M 180 320 C 192 342 222 360 256 370 C 245 375 230 376 215 372 C 185 364 168 340 162 315 C 165 315 174 316 180 320 Z"
          fill="#059669"
        />
        <path
          d="M 347 305 C 337 285 314 275 292 288 C 277 297 264 312 256 325 C 266 332 280 338 297 338 C 320 338 340 324 347 305 Z"
          fill="url(#aiHandRight)"
        />
        <path
          d="M 332 320 C 320 342 290 360 256 370 C 267 375 282 376 297 372 C 327 364 344 340 350 315 C 347 315 338 316 332 320 Z"
          fill="#047857"
        />
      </g>

      {/* Heart */}
      <path
        d="M 256 285 C 256 285 200 242 200 200 C 200 176 218 158 241 158 C 247 158 252 160 256 164 C 260 160 265 158 271 158 C 294 158 312 176 312 200 C 312 242 256 285 256 285 Z"
        fill="url(#aiHeartGrad)"
      />
      <path
        d="M 215 186 C 215 174 225 166 236 166 C 240 166 243 167 245 169 C 241 173 234 182 233 192 C 223 192 215 190 215 186 Z"
        fill="#ffffff"
        opacity={0.55}
      />

      {/* Sparkle */}
      <g fill="url(#aiGoldGrad)">
        <path d="M 256 100 Q 256 112 268 112 Q 256 112 256 124 Q 256 112 244 112 Q 256 112 256 100 Z" />
        <circle cx="256" cy="112" r={2.5} fill="#ffffff" />
        <circle cx="178" cy="270" r={3} fill="#fef08a" opacity={0.8} />
        <circle cx="334" cy="270" r={3} fill="#fef08a" opacity={0.8} />
      </g>

      {/* Inner Gold Banner Accent */}
      <path d="M 210 405 L 302 405 L 292 419 L 220 419 Z" fill="url(#aiGoldGrad)" opacity={0.9} />
      <circle cx="256" cy="412" r={2.5} fill="#022c22" />
    </svg>
  );
};
