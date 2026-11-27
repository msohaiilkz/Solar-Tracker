/* Print the current page as a clean, light report.
   Switches to the light theme for the printout, then restores the user's theme. */
export function printReport(theme) {
  const wasDark = theme?.theme === "dark";
  if (wasDark) theme.set("light");
  setTimeout(() => {
    window.print();
    if (wasDark) theme.set("dark");
  }, wasDark ? 450 : 50);
}
