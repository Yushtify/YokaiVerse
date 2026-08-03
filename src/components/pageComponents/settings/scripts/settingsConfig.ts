export interface SettingButtonsConfig {
  id: string;
  symbols: {
    active: string;
    deactive: string;
  };
}
export interface PlayerConfig {
  buttons: {
    animationsToggleButton: SettingButtonsConfig;
    nsfwButton: SettingButtonsConfig;
    timelineSegmentsButton: SettingButtonsConfig;
  };
  GoogleMaterialSymbol: string;
}

export const config: PlayerConfig = {
  buttons: {
    animationsToggleButton: {
      id: "animationsToggle_Button",
      symbols: { active: "check", deactive: "close" },
    },
    nsfwButton: {
      id: "nsfwToggle_Button",
      symbols: { active: "shield_with_heart", deactive: "remove_moderator" },
    },
    timelineSegmentsButton: {
      id: "timelineSegmentsToggle_Button",
      symbols: { active: "check", deactive: "close" },
    },
  },
  GoogleMaterialSymbol: "#googleSymbol",
};
