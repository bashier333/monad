# Generic CSV settlement export

Works today with zero setup if your file has these columns (any header wording close to
these — the detector handles variants like `Dest`, `Unit`, `Rate`):

Required: load ID, date, revenue per load.
Recommended: origin, destination, driver, truck, miles, broker, detention.

Shape it like `fixtures/tms-week.csv` and upload. Confirm the detected mapping once —
your correction becomes the default for every future upload.
