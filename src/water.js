export const waterVertex = `
varying vec3 worldPosition;
void main(){worldPosition=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(worldPosition,1.);}`;
export const waterFragment = `
uniform float time;
uniform float daylight;
uniform vec3 lightDirection;
uniform float coast[24];
uniform vec2 rippleOrigin[8];
uniform float rippleAge[8];
varying vec3 worldPosition;
const float TAU=6.28318530718;
float coastRadius(float angle){float p=fract(angle/TAU+1.)*24.;int i=int(floor(p));float t=smoothstep(0.,1.,fract(p));return mix(coast[i],coast[(i+1)%24],t);}
float waves(vec2 p){return sin(p.x*.55+p.y*.24+time*.8)*.055+sin(p.x*.28-p.y*.69-time*.62)*.036+sin(p.x*1.6+p.y*1.1+time*.95)*.008;}
void main(){
 vec2 p=worldPosition.xz;float r=length(p/vec2(113.,103.));float d=(r-coastRadius(atan(p.y/103.,p.x/113.)))*108.;
 float depth=max(0.,d*.15);float blend=smoothstep(.0,4.5,depth);
 vec3 shallow=vec3(.31,.67,.62),deep=vec3(.075,.29,.37);
 float h=waves(p),hx=waves(p+vec2(.12,0.)),hz=waves(p+vec2(0.,.12));
 vec3 n=normalize(vec3((h-hx)/.12,1.,(h-hz)/.12));vec3 view=normalize(cameraPosition-worldPosition);
 float fresnel=pow(1.-max(dot(n,view),0.),3.);vec3 col=mix(shallow,deep,blend);
 float caustic=pow(max(0.,sin(p.x*2.1+sin(p.y*1.2)+time*.5)*sin(p.y*2.4-sin(p.x)+time*.4)),8.);
 col+=vec3(.10,.16,.11)*caustic*(1.-blend)*daylight;
 col=mix(col,vec3(.57,.74,.78),fresnel*.48);
 float foam=(1.-smoothstep(.2,1.3,abs(d-(sin(time*.5+p.x*.018)*.6+.5))))*.48;
 foam*=.45+.55*pow(.5+.5*sin(p.x*2.8+p.y*3.1+sin(time)),2.);
 float crest=pow(max(0.,sin(d*1.15-time*.7+h*3.)),18.)*(1.-smoothstep(1.,9.,d))*.2;
 col=mix(col,vec3(.85,.94,.87),clamp(foam+crest,0.,.8));
 col*=mix(vec3(.16,.24,.42),vec3(1.),daylight);
 float spec=pow(max(dot(n,normalize(lightDirection+view)),0.),95.);
 col+=spec*mix(vec3(.24,.35,.53),vec3(.92,.79,.49),daylight)*.75;
 for(int i=0;i<8;i++){float age=rippleAge[i];if(age>=0.&&age<1.5){float dist=distance(p,rippleOrigin[i]);float ring=1.-smoothstep(.02,.11,abs(dist-(.13+age*.9)));float wake=ring*(1.-age/1.5);col+=vec3(.5,.68,.68)*wake*.32;}}
 gl_FragColor=vec4(col,mix(.43,.97,smoothstep(0.,1.8,depth)));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
