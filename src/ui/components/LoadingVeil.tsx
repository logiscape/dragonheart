import React from "react";
import logoMark from "@assets/logo-mark.svg";

export function LoadingVeil() {
  return (
    <div className="dh-veil">
      <img className="dh-veil__mark" src={logoMark} width={72} height={72} alt="" />
      <p className="dh-veil__text">Tending the fire…</p>
    </div>
  );
}
