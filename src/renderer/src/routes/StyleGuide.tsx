import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { SegmentedToggle } from '../components/SegmentedToggle';
import { Field, SelectField } from '../components/Field';
import { StatusPill, FullVideoCheckbox } from '../components/Badge';

export const StyleGuide: React.FC = () => {
  const [toggleVal, setToggleVal] = useState<'video' | 'audio'>('video');
  const [formatVal, setFormatVal] = useState('MP4');
  const [fullVideo, setFullVideo] = useState(false);
  const [frameAccurate, setFrameAccurate] = useState(false);

  return (
    <div className="w-full h-screen overflow-y-auto bg-background text-foreground p-8 box-border font-sans">
      {/* Title */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-[10px] bg-accent flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A0805" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">YouCut v2.0 — Design Tokens & Component Guide</h1>
        </div>
        <p className="text-foreground-muted text-sm">
          Extracted from HTML/CSS design mocks & PNG source of truth. Dark theme strictly enforced at 1176x784 logical resolution.
        </p>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        {/* 1. Color Tokens */}
        <section>
          <h2 className="font-display text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" /> Color Palette & Theme Tokens
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-[14px] bg-[#0B0C10] border border-border">
              <div className="h-10 rounded-[8px] bg-[#0B0C10] border border-border mb-2" />
              <div className="text-xs font-semibold text-foreground">Background</div>
              <div className="text-[11px] font-mono text-foreground-muted">#0B0C10</div>
            </div>
            <div className="p-3.5 rounded-[14px] bg-[#0F1116] border border-border">
              <div className="h-10 rounded-[8px] bg-[#0F1116] border border-border mb-2" />
              <div className="text-xs font-semibold text-foreground">Sidebar</div>
              <div className="text-[11px] font-mono text-foreground-muted">#0F1116</div>
            </div>
            <div className="p-3.5 rounded-[14px] bg-[#14161D] border border-border">
              <div className="h-10 rounded-[8px] bg-[#14161D] border border-border mb-2" />
              <div className="text-xs font-semibold text-foreground">Card</div>
              <div className="text-[11px] font-mono text-foreground-muted">#14161D</div>
            </div>
            <div className="p-3.5 rounded-[14px] bg-[#1B1E27] border border-border">
              <div className="h-10 rounded-[8px] bg-[#1B1E27] border border-border mb-2" />
              <div className="text-xs font-semibold text-foreground">Surface</div>
              <div className="text-[11px] font-mono text-foreground-muted">#1B1E27</div>
            </div>

            {/* Accents */}
            <div className="p-3.5 rounded-[14px] bg-card border border-border">
              <div className="h-10 rounded-[8px] bg-accent mb-2" />
              <div className="text-xs font-semibold text-foreground">YouTube Accent</div>
              <div className="text-[11px] font-mono text-foreground-muted">#FF5B4A</div>
            </div>
            <div className="p-3.5 rounded-[14px] bg-card border border-border">
              <div className="h-10 rounded-[8px] bg-[#2A1B19] border border-accent flex items-center justify-center text-[#FF8C7E] text-xs font-bold mb-2">
                YouTube Tint
              </div>
              <div className="text-xs font-semibold text-foreground">YouTube Tint</div>
              <div className="text-[11px] font-mono text-foreground-muted">#2A1B19 / #FF8C7E</div>
            </div>
            <div className="p-3.5 rounded-[14px] bg-card border border-border">
              <div className="h-10 rounded-[8px] bg-[#2B1A26] border border-[#F28BB8] flex items-center justify-center text-[#F28BB8] text-xs font-bold mb-2">
                Instagram Tint
              </div>
              <div className="text-xs font-semibold text-foreground">Instagram Tint</div>
              <div className="text-[11px] font-mono text-foreground-muted">#2B1A26 / #F28BB8</div>
            </div>
            <div className="p-3.5 rounded-[14px] bg-card border border-border">
              <div className="h-10 rounded-[8px] bg-[#17233D] border border-[#8DB4FF] flex items-center justify-center text-[#8DB4FF] text-xs font-bold mb-2">
                Facebook Tint
              </div>
              <div className="text-xs font-semibold text-foreground">Facebook Tint</div>
              <div className="text-[11px] font-mono text-foreground-muted">#17233D / #8DB4FF</div>
            </div>

            {/* Status */}
            <div className="p-3.5 rounded-[14px] bg-card border border-border">
              <div className="h-10 rounded-[8px] bg-status-success mb-2" />
              <div className="text-xs font-semibold text-foreground">Status Success</div>
              <div className="text-[11px] font-mono text-foreground-muted">#3DDC97</div>
            </div>
            <div className="p-3.5 rounded-[14px] bg-card border border-border">
              <div className="h-10 rounded-[8px] bg-ticks mb-2" />
              <div className="text-xs font-semibold text-foreground">Timeline Ticks</div>
              <div className="text-[11px] font-mono text-foreground-muted">#4A5062</div>
            </div>
            <div className="p-3.5 rounded-[14px] bg-card border border-border">
              <div className="h-10 rounded-[8px] bg-[#232733] mb-2" />
              <div className="text-xs font-semibold text-foreground">Border Default</div>
              <div className="text-[11px] font-mono text-foreground-muted">#232733</div>
            </div>
            <div className="p-3.5 rounded-[14px] bg-card border border-border">
              <div className="h-10 rounded-[8px] bg-[#2A2E3B] mb-2" />
              <div className="text-xs font-semibold text-foreground">Border Strong</div>
              <div className="text-[11px] font-mono text-foreground-muted">#2A2E3B</div>
            </div>
          </div>
        </section>

        {/* 2. Typography & Fonts */}
        <section>
          <h2 className="font-display text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" /> Typography & Hindi Script Support
          </h2>
          <Card className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <div>
                <span className="font-display text-xl font-bold">Space Grotesk Bold 20px</span>
                <span className="text-foreground-muted text-xs ml-3 font-mono">Headings, Logo, Card Titles</span>
              </div>
              <span className="text-foreground-subtle font-display text-lg font-semibold">01:22 / 04:47</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <div>
                <span className="text-base font-semibold">Inter Semibold 16px</span>
                <span className="text-foreground-muted text-xs ml-3 font-mono">Body Primary, Buttons, Field Values</span>
              </div>
              <span className="text-foreground-muted text-sm">Inter Regular 14px</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-sm font-semibold text-foreground">Hindi Title Rendering (Nirmala UI fallback):</span>
                <span className="ml-3 text-sm text-foreground-subtle font-sans">
                  नमस्ते दुनिया — इंटरस्टेलर मुख्य थीम (Hans Zimmer Cover)
                </span>
              </div>
              <span className="text-status-success text-xs font-semibold">Verified UTF-8</span>
            </div>
          </Card>
        </section>

        {/* 3. Component Gallery */}
        <section>
          <h2 className="font-display text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" /> Component Library
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Buttons */}
            <Card title="Buttons">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2.5 items-center">
                  <Button variant="primary" size="lg">
                    Fetch info
                  </Button>
                  <Button variant="secondary" size="lg">
                    Paste
                  </Button>
                  <Button variant="accent-tint" size="sm" pill>
                    Play selection
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2.5 items-center pt-2">
                  <Button variant="secondary" size="xl">
                    Add to queue
                  </Button>
                  <Button variant="primary" size="xl" className="flex-1" leftIcon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A0805" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v12m0 0-5-5m5 5 5-5M5 21h14" />
                    </svg>
                  }>
                    {fullVideo ? 'Download full video' : 'Download clip'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 items-center pt-2">
                  <Button variant="outline" size="sm" pill>First 30s</Button>
                  <Button variant="outline" size="sm" pill>First 60s</Button>
                  <Button variant="outline" size="sm" pill>Middle 50%</Button>
                  <Button variant="outline" size="sm" pill>Last 30s</Button>
                  <Button variant="outline" size="sm" pill>Reset</Button>
                </div>
              </div>
            </Card>

            {/* Platform Chips & Badges */}
            <Card title="Chips, Badges & Toggles">
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-foreground-muted mb-2 font-semibold">Platform Chips</div>
                  <div className="flex gap-2">
                    <Chip variant="platform-youtube">YouTube</Chip>
                    <Chip variant="platform-instagram">Instagram</Chip>
                    <Chip variant="platform-facebook">Facebook</Chip>
                    <Chip variant="preview-tag">Live preview</Chip>
                    <Chip variant="preview-tag" className="text-foreground-subtle">1080p60</Chip>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-foreground-muted mb-2 font-semibold">Segmented Toggle</div>
                  <SegmentedToggle
                    value={toggleVal}
                    onChange={setToggleVal}
                    options={[
                      { value: 'video', label: 'Video' },
                      { value: 'audio', label: 'Audio only' }
                    ]}
                  />
                </div>

                <div>
                  <div className="text-xs text-foreground-muted mb-2 font-semibold">Format Chips</div>
                  <div className="flex gap-2">
                    {['MP4', 'MOV', 'GIF'].map((fmt) => (
                      <Chip
                        key={fmt}
                        variant="format"
                        selected={formatVal === fmt}
                        onClick={() => setFormatVal(fmt)}
                      >
                        {fmt}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <FullVideoCheckbox checked={fullVideo} onChange={setFullVideo} />
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={frameAccurate}
                      onClick={() => setFrameAccurate(!frameAccurate)}
                      className={`w-11 h-[26px] rounded-full p-[3px] transition-colors flex items-center ${
                        frameAccurate ? 'bg-accent justify-end' : 'bg-[#2A2E3B] justify-start'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full ${frameAccurate ? 'bg-[#1A0805]' : 'bg-[#C6CAD5]'}`} />
                    </button>
                    <span className="text-[13px] text-foreground-subtle">
                      Frame-accurate <span className="text-foreground-muted">· slower</span>
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Inputs & Fields */}
            <Card title="Input Fields & Dropdowns">
              <div className="space-y-4">
                <Field
                  label="File name"
                  defaultValue="Interstellar - Main Theme - Hans Zimmer [00.00.48-00.03.12]"
                  suffix={`.${formatVal.toLowerCase()}`}
                />
                <Field
                  label="Folder"
                  defaultValue="Downloads\YouCut\YouTube"
                  readOnly
                  rightAction={
                    <Button variant="secondary" size="md">
                      Browse
                    </Button>
                  }
                />
                <SelectField
                  label="Quality"
                  value="1080p"
                  displayValue="Best available · 1080p"
                />
              </div>
            </Card>

            {/* Status Pills */}
            <Card title="Status Pills & Notifications">
              <div className="space-y-3">
                <StatusPill state="ready" />
                <StatusPill state="fetching" />
                <StatusPill state="downloading" count={{ n: 2, m: 5 }} />
                <StatusPill state="update" />
              </div>
            </Card>
          </div>
        </section>

        {/* 4. Start / End Trim Cards */}
        <section>
          <h2 className="font-display text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" /> Trim Cards & Timecode Display
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2.5 p-3 px-4 rounded-[14px] bg-[#0F1116] border border-border">
              <div className="flex-1">
                <div className="text-[11px] font-semibold tracking-wider text-foreground-muted mb-0.5">START</div>
                <div className="font-display text-[22px] font-semibold text-foreground">00:48</div>
              </div>
              <Button variant="secondary" size="sm">-1s</Button>
              <Button variant="secondary" size="sm">+1s</Button>
              <Button variant="secondary" size="sm" className="text-accent">Use playhead</Button>
            </div>

            <div className="flex items-center gap-2.5 p-3 px-4 rounded-[14px] bg-[#0F1116] border border-border">
              <div className="flex-1">
                <div className="text-[11px] font-semibold tracking-wider text-foreground-muted mb-0.5">END</div>
                <div className="font-display text-[22px] font-semibold text-foreground">03:12</div>
              </div>
              <Button variant="secondary" size="sm">-1s</Button>
              <Button variant="secondary" size="sm">+1s</Button>
              <Button variant="secondary" size="sm" className="text-accent">Use playhead</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
