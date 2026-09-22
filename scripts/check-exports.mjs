const expected = {
  jevlish: ["given", "from", "means"],
  "jevlish/runtime": ["Runtime", "resolvePolicy"],
  "jevlish/testing": ["fake", "yes"],
  "jevlish/types": ["Given", "From"],
};

for (const [specifier, names] of Object.entries(expected)) {
  const entry = await import(specifier);
  for (const name of names) {
    if (!(name in entry)) {
      throw new Error(`${specifier} does not export ${name}`);
    }
  }
}

console.log("package exports ok");
