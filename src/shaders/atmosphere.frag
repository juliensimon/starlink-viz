uniform vec3 glowColor;
uniform float intensity;
uniform float power;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float fresnel = 1.0 - dot(viewDirection, vNormal);
  fresnel = pow(fresnel, power);
  float alpha = fresnel * intensity;
  gl_FragColor = vec4(glowColor, alpha);
}
