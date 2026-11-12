-- Remove localization tags that Exploration's TechnologiesText.xml re-defines.
DELETE FROM LocalizedText WHERE Tag IN ('LOC_TECH_FUTURE_TECH_AUTHOR','LOC_TECH_FUTURE_TECH_NAME','LOC_TECH_FUTURE_TECH_QUOTE');
