const requiredPositiveNumber = (value, propertyName) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error(
      `PDF Builder configuration "${propertyName}" must be greater than zero.`
    );
  }
  return numberValue;
};

const requiredNonNegativeNumber = (value, propertyName) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(
      `PDF Builder configuration "${propertyName}" must be zero or greater.`
    );
  }
  return numberValue;
};

export const resolveBuilderConfiguration = (configuration = {}) => {
  return {
    pageWidth: requiredPositiveNumber(configuration.pageWidth, "pageWidth"),
    pageHeight: requiredPositiveNumber(configuration.pageHeight, "pageHeight"),
    defaultPagePadding: requiredNonNegativeNumber(
      configuration.defaultPagePadding,
      "defaultPagePadding"
    ),
    defaultElementPadding: requiredNonNegativeNumber(
      configuration.defaultElementPadding,
      "defaultElementPadding"
    ),
    defaultHeaderHeight: requiredPositiveNumber(
      configuration.defaultHeaderHeight,
      "defaultHeaderHeight"
    ),
    defaultFooterHeight: requiredPositiveNumber(
      configuration.defaultFooterHeight,
      "defaultFooterHeight"
    ),
    maxPages: requiredPositiveNumber(configuration.maxPages, "maxPages"),
    longTextLimit: requiredPositiveNumber(
      configuration.longTextLimit,
      "longTextLimit"
    ),
    maxClientImageBase64Length: requiredPositiveNumber(
      configuration.maxClientImageBase64Length,
      "maxClientImageBase64Length"
    ),
    dragGridSize: requiredPositiveNumber(
      configuration.dragGridSize,
      "dragGridSize"
    ),
    inputDebounceMilliseconds: requiredNonNegativeNumber(
      configuration.inputDebounceMilliseconds,
      "inputDebounceMilliseconds"
    )
  };
};

export const formatTemplateOptions = (templates = []) => {
  return (templates || []).map((template) => {
    const objectAbbreviation = String(template.objectApiName || "")
      .slice(0, 3)
      .toUpperCase();

    return {
      ...template,
      displayName: objectAbbreviation
        ? `${template.name} (${objectAbbreviation})`
        : template.name
    };
  });
};
