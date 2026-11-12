-- Continuous Civilization - tech note on Exploration and Modern resource tooltips (data/65-modern-resources.sql).
-- Keep the tech names in step with cc_resource_unlocks there.
UPDATE LocalizedText SET Text = Text || '[N]Inactive until you research Shipbuilding.'
  WHERE Language = 'en_US' AND Tag IN ('LOC_MOD_RESOURCE_COFFEE_TOOLTIP', 'LOC_MOD_RESOURCE_TOBACCO_TOOLTIP', 'LOC_MOD_RESOURCE_CITRUS_TOOLTIP');
UPDATE LocalizedText SET Text = Text || '[N]Inactive until you research Education.'
  WHERE Language = 'en_US' AND Tag = 'LOC_MOD_RESOURCE_QUININE_TOOLTIP';
UPDATE LocalizedText SET Text = Text || '[N]Inactive until you research Metallurgy.'
  WHERE Language = 'en_US' AND Tag = 'LOC_MOD_RESOURCE_COAL_TOOLTIP';
UPDATE LocalizedText SET Text = Text || '[N]Inactive until you research Metal Casting.'
  WHERE Language = 'en_US' AND Tag = 'LOC_MOD_RESOURCE_NICKEL_TOOLTIP';
UPDATE LocalizedText SET Text = Text || '[N]Inactive until you research Gunpowder.'
  WHERE Language = 'en_US' AND Tag IN ('LOC_MOD_RESOURCE_OIL_TOOLTIP', 'LOC_MOD_RESOURCE_RUBBER_TOOLTIP');
UPDATE LocalizedText SET Text = Text || '[N]Inactive until you research Cartography.'
  WHERE Language = 'en_US' AND Tag IN ('LOC_EXP_RESOURCE_WHALES_TOOLTIP', 'LOC_ANT_RESOURCE_PITCH_TOOLTIP', 'LOC_EXP_RESOURCE_SPICES_TOOLTIP', 'LOC_EXP_RESOURCE_CLOVES_TOOLTIP');
UPDATE LocalizedText SET Text = Text || '[N]Inactive until you research Guilds.'
  WHERE Language = 'en_US' AND Tag IN ('LOC_EXP_RESOURCE_SUGAR_TOOLTIP', 'LOC_EXP_RESOURCE_TEA_TOOLTIP', 'LOC_EXP_RESOURCE_COCOA_TOOLTIP', 'LOC_EXP_RESOURCE_FURS_TOOLTIP', 'LOC_EXP_RESOURCE_TRUFFLES_TOOLTIP');
UPDATE LocalizedText SET Text = Text || '[N]Inactive until you research Machinery.'
  WHERE Language = 'en_US' AND Tag = 'LOC_EXP_RESOURCE_NITER_TOOLTIP';
