import { useEffect, useRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const vertexShader = `
attribute vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}
`;

const fragmentShader = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_colorBottom;
uniform vec3 u_colorMid;
uniform vec3 u_colorTop;
uniform float u_speed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));
  vec2 u=f*f*(3.-2.*f);
  return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
}
float fbm(vec2 p,float t){
  float v=0.,a=.5,fi=0.;
  mat2 rot=mat2(.86,.51,-.51,.86);
  for(int i=0;i<5;i++){
    vec2 morph=vec2(sin(t*.5+fi),cos(t*.3-fi))*.05;
    v+=a*noise(p+morph);p=rot*p*2.;a*=.5;fi+=1.;
  }
  return v;
}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time*u_speed;
  vec2 aspect=vec2(u_resolution.x/max(u_resolution.y,1.),1.);
  vec2 p=(uv-.5)*aspect;
  float pattern=fbm(p*2.2-vec2(t*.1,t*.02),t);
  float low=smoothstep(.3,.65,pattern);
  float high=smoothstep(.7,.95,pattern);
  vec3 color=mix(u_colorBottom,u_colorMid,low);
  color=mix(color,u_colorTop,high);
  gl_FragColor=vec4(color,1.);
}
`;

interface CloudscapeProps extends HTMLAttributes<HTMLDivElement> {
  colorBottom?: string;
  colorMid?: string;
  colorTop?: string;
  speed?: number;
  height?: string;
}

function toRgb(hex: string): [number, number, number] {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "0d1117";
  return [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16) / 255) as [number, number, number];
}

export default function Cloudscape({
  colorBottom = "#87ceeb",
  colorMid = "#f8f8f8",
  colorTop = "#ffffff",
  speed = 1,
  height = "100vh",
  className,
  style,
  children,
  ...props
}: CloudscapeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const redraw = useRef<() => void>(()=>{});
  const settings = useRef({ bottom:toRgb(colorBottom), mid:toRgb(colorMid), top:toRgb(colorTop), speed });
  useEffect(() => {
    settings.current = { bottom:toRgb(colorBottom), mid:toRgb(colorMid), top:toRgb(colorTop), speed };
    redraw.current();
  }, [colorBottom,colorMid,colorTop,speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth:false, stencil:false });
    if (!gl) return;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexShader);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
    if (!vertex || !fragment) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      return;
    }
    const program = gl.createProgram();
    if (!program) { gl.deleteShader(vertex); gl.deleteShader(fragment); return; }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    const release = () => { gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); };
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { release(); return; }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    if (!buffer) { release(); return; }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, "u_resolution");
    const time = gl.getUniformLocation(program, "u_time");
    const bottom = gl.getUniformLocation(program, "u_colorBottom");
    const mid = gl.getUniformLocation(program, "u_colorMid");
    const top = gl.getUniformLocation(program, "u_colorTop");
    const velocity = gl.getUniformLocation(program, "u_speed");
    if (!resolution || !time || !bottom || !mid || !top || !velocity) { gl.deleteBuffer(buffer); release(); return; }
    const resize = () => {
      const bounds = host.getBoundingClientRect();
      // Soft clouds need no retina-sized buffer; cap GPU work on large screens.
      const scale = Math.min(1, Math.sqrt(650000 / Math.max(1,bounds.width * bounds.height)));
      canvas.width = Math.max(1, Math.floor(bounds.width * scale));
      canvas.height = Math.max(1, Math.floor(bounds.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      redraw.current();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionPreference.matches;
    let frame = 0, visible = false, elapsed = 0, previous = 0;
    const current = { bottom:[...settings.current.bottom], mid:[...settings.current.mid], top:[...settings.current.top], speed:settings.current.speed };
    // Paint one frame synchronously: with alpha:false the backbuffer defaults to
    // opaque black until the first draw, which otherwise flashes before the
    // IntersectionObserver/rAF loop below gets a chance to run.
    gl.uniform1f(time, 0);
    gl.uniform3fv(bottom, current.bottom); gl.uniform3fv(mid, current.mid); gl.uniform3fv(top, current.top);
    gl.uniform1f(velocity, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const paint = (now: number) => {
      frame = 0;
      if (!visible || document.hidden) { previous=0; return; }
      const dt = previous ? Math.min((now-previous)/1000,.05) : 1/60;
      previous=now;
      const blend=reducedMotion ? 1 : 1-Math.exp(-dt*5);
      for (const key of ["bottom","mid","top"] as const) for(let i=0;i<3;i++) current[key][i]+=(settings.current[key][i]-current[key][i])*blend;
      current.speed+=(settings.current.speed-current.speed)*blend;
      elapsed+=dt*current.speed;
      gl.uniform1f(time, reducedMotion ? 0 : elapsed);
      gl.uniform3fv(bottom,current.bottom);gl.uniform3fv(mid,current.mid);gl.uniform3fv(top,current.top);
      gl.uniform1f(velocity,1);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      if (!reducedMotion) frame=requestAnimationFrame(paint);
    };
    const resume=()=>{ if(visible && !document.hidden && !frame) frame=requestAnimationFrame(paint); };
    redraw.current=resume;
    const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting; if(visible) resume(); else {cancelAnimationFrame(frame);frame=0;previous=0;} });
    visibility.observe(host);
    const changeMotion = () => {
      reducedMotion = motionPreference.matches;
      cancelAnimationFrame(frame); frame = 0; previous = 0; resume();
    };
    motionPreference.addEventListener("change", changeMotion);
    document.addEventListener("visibilitychange",resume);
    return () => {
      motionPreference.removeEventListener("change", changeMotion);
      redraw.current=()=>{};
      cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();document.removeEventListener("visibilitychange",resume);gl.deleteBuffer(buffer);gl.deleteProgram(program);
      gl.deleteShader(vertex);gl.deleteShader(fragment);
    };
  }, []);

  return (
    <div ref={hostRef} className={cn("cloudscape", className)} style={{ height, background: `linear-gradient(to top, ${colorBottom}, ${colorMid}, ${colorTop})`, ...style }} {...props}>
      <canvas ref={canvasRef} className="cloudscape__canvas" aria-hidden="true" />
      {children}
    </div>
  );
}
