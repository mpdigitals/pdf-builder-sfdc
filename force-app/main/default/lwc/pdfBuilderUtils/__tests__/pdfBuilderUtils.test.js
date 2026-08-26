import {
  formatTemplateOptions,
  resolveBuilderConfiguration
} from "c/pdfBuilderUtils";

describe("pdfBuilderUtils", () => {
  it("rejects missing or invalid organization configuration", () => {
    expect(() =>
      resolveBuilderConfiguration({
        pageWidth: 0
      })
    ).toThrow('configuration "pageWidth" must be greater than zero');

    expect(() => resolveBuilderConfiguration()).toThrow(
      'configuration "pageWidth" must be greater than zero'
    );
  });

  it("applies valid organization configuration", () => {
    expect(
      resolveBuilderConfiguration({
        pageWidth: 800,
        pageHeight: 1200,
        defaultPagePadding: 40,
        defaultElementPadding: 10,
        defaultHeaderHeight: 120,
        defaultFooterHeight: 90,
        maxPages: 8,
        longTextLimit: 100000,
        maxClientImageBase64Length: 1500000,
        dragGridSize: 12,
        inputDebounceMilliseconds: 0
      })
    ).toEqual({
      pageWidth: 800,
      pageHeight: 1200,
      defaultPagePadding: 40,
      defaultElementPadding: 10,
      defaultHeaderHeight: 120,
      defaultFooterHeight: 90,
      maxPages: 8,
      longTextLimit: 100000,
      maxClientImageBase64Length: 1500000,
      dragGridSize: 12,
      inputDebounceMilliseconds: 0
    });
  });

  it("adds the three-letter object abbreviation without changing option data", () => {
    expect(
      formatTemplateOptions([
        { id: "one", name: "Proposal", objectApiName: "Account" },
        { id: "two", name: "Generic", objectApiName: "" }
      ])
    ).toEqual([
      {
        id: "one",
        name: "Proposal",
        objectApiName: "Account",
        displayName: "Proposal (ACC)"
      },
      {
        id: "two",
        name: "Generic",
        objectApiName: "",
        displayName: "Generic"
      }
    ]);
  });
});
