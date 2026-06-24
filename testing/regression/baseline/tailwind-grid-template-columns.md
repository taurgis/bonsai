Utilities for specifying the columns in a grid layout.

## [Examples](https://tailwindcss.com/docs/grid-template-columns#examples)

### [Specifying the grid columns](https://tailwindcss.com/docs/grid-template-columns#specifying-the-grid-columns)

Use `grid-cols-<number>` utilities like `grid-cols-2` and `grid-cols-4` to create grids with _n_ equally sized columns:

01

02

03

04

05

06

07

08

09

```
<div class="grid grid-cols-4 gap-4">
  <div>01</div>
  <!-- ... -->
  <div>09</div>
</div>
```

### [Implementing a subgrid](https://tailwindcss.com/docs/grid-template-columns#implementing-a-subgrid)

Use the `grid-cols-subgrid` utility to adopt the column tracks defined by the item's parent:

01

02

03

04

05

06

```
<div class="grid grid-cols-4 gap-4">
  <div>01</div>
  <!-- ... -->
  <div>05</div>
  <div class="col-span-3 grid grid-cols-subgrid gap-4">
    <div class="col-start-2">06</div>
  </div>
</div>
```

### [Using a custom value](https://tailwindcss.com/docs/grid-template-columns#using-a-custom-value)

Use the `grid-cols-[<value>]` syntax to set the columns based on a completely custom value:

```
<div class="grid-cols-[200px_minmax(900px,_1fr)_100px] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `grid-cols-(<custom-property>)` syntax:

```
<div class="grid-cols-(--my-grid-cols) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `grid-cols-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### [Responsive design](https://tailwindcss.com/docs/grid-template-columns#responsive-design)

Prefix a `grid-template-columns` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```
<div class="grid grid-cols-1 md:grid-cols-6 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the [variants documentation](https://tailwindcss.com/docs/hover-focus-and-other-states).
