## [Try it](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#try_it)

```
display: inline flow-root;
```

```
<p>
  Apply different <code>display</code> values on the dashed orange-bordered
  <code>div</code>, which contains three child elements.
</p>
<section class="default-example" id="default-example">
  <div class="example-container">
    Some text A.
    <div id="example-element">
      <div class="child">Child 1</div>
      <div class="child">Child 2</div>
      <div class="child">Child 3</div>
    </div>
    Some text B.
  </div>
</section>
```

```
.example-container {
  width: 100%;
  height: 100%;
}

code {
  background: #88888888;
}

#example-element {
  border: 3px dashed orange;
}

.child {
  display: inline-block;
  padding: 0.5em 1em;
  background-color: #ccccff;
  border: 1px solid #ababab;
  color: black;
}
```

## [Syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#syntax)

css

```
/* short display */
display: none;
display: contents;
display: block;
display: flow-root;
display: inline;
display: inline-block;
display: list-item;
display: inline list-item;
display: flex;
display: inline-flex;
display: grid;
display: inline-grid;
display: table;
display: inline-table;

/* full display */
display: block flow;
display: block flow-root;
display: inline flow;
display: inline flow-root;
display: block flow list-item;
display: inline flow list-item;
display: block flex;
display: inline flex;
display: block grid;
display: inline grid;
display: block table;
display: inline table;

/* global values */
display: inherit;
display: initial;
display: revert;
display: revert-layer;
display: unset;
```

The CSS `display` property is specified using keyword values.

## [Grouped values](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#grouped_values)

The keyword values can be grouped into six value categories.

### [Outside](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#outside)

[`<display-outside>`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/display-outside)

These keywords specify the element's outer display type, which is essentially its role in flow layout:

[`block`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#block)

The element generates a block box, generating line breaks both before and after the element when in the normal flow.

[`inline`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#inline)

The element generates one or more inline boxes that do not generate line breaks before or after themselves. In normal flow, the next element will be on the same line if there is space.

**Note:** When a display property is specified with only an **outer** value (e.g., `display: block` or `display: inline`), the inner value defaults to `flow` (e.g., `display: block flow` and `display: inline flow`).

**Note:** You may use the single-value syntax as a fallback for multi-keyword syntax, for example `display: inline flex` could have the following fallback

css

```
.container {
  display: inline-flex;
  display: inline flex;
}
```

See [Using the multi-keyword syntax with CSS display](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Multi-keyword_syntax) for more information.

### [Inside](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#inside)

[`<display-inside>`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/display-inside)

These keywords specify the element's inner display type, which defines the type of formatting context that its contents are laid out in (assuming it is a non-replaced element). When one of these keywords is used by itself as a single value, the element's outer display type defaults to `block` (with the exception of `ruby`, which defaults to `inline`).

[`flow`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#flow)

The element lays out its contents using flow layout (block-and-inline layout).

If its outer display type is `inline`, and it is participating in a block or inline formatting context, then it generates an inline box. Otherwise it generates a block box.

Depending on the value of other properties (such as [`position`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position), [`float`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/float), or [`overflow`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow)) and whether it is itself participating in a block or inline formatting context, it either establishes a new [block formatting context](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Block_formatting_context) (BFC) for its contents or integrates its contents into its parent formatting context.

[`flow-root`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#flow-root)

The element generates a block box that establishes a new [block formatting context](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Block_formatting_context), defining where the formatting root lies.

[`table`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#table)

These elements behave like HTML [`<table>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table) elements. It defines a block-level box.

[`flex`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#flex)

The element behaves like a block-level element and lays out its content according to the [flexbox model](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout).

[`grid`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#grid)

The element behaves like a block-level element and lays out its content according to the [grid model](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Basic_concepts).

[`ruby`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#ruby)

The element behaves like an inline-level element and lays out its content according to the ruby formatting model. It behaves like the corresponding HTML [`<ruby>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ruby) elements.

**Note:** When a display property is specified with only an **inner** value (e.g., `display: flex` or `display: grid`), the outer value defaults to `block` (e.g., `display: block flex` and `display: block grid`).

### [List Item](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#list_item)

[`<display-listitem>`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/display-listitem)

The element generates a block box for the content and a separate list-item inline box.

A single value of `list-item` will cause the element to behave like a list item. This can be used together with [`list-style-type`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/list-style-type) and [`list-style-position`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/list-style-position).

`list-item` can also be combined with any [`<display-outside>`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/display-outside) keyword and the `flow` or `flow-root` [`<display-inside>`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/display-inside) keyword.

**Note:** If no inner value is specified, it will default to `flow`. If no outer value is specified, the principal box will have an outer display type of `block`.

### [Internal](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#internal)

[`<display-internal>`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/display-internal)

Some layout models such as `table` and `ruby` have a complex internal structure, with several different roles that their children and descendants can fill. This section defines those "internal" display values, which only have meaning within that particular layout mode.

[`table-row-group`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#table-row-group)

These elements behave like [`<tbody>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tbody) HTML elements.

[`table-header-group`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#table-header-group)

These elements behave like [`<thead>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/thead) HTML elements.

[`table-footer-group`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#table-footer-group)

These elements behave like [`<tfoot>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tfoot) HTML elements.

[`table-row`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#table-row)

These elements behave like [`<tr>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tr) HTML elements.

[`table-cell`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#table-cell)

These elements behave like [`<td>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td) HTML elements.

[`table-column-group`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#table-column-group)

These elements behave like [`<colgroup>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/colgroup) HTML elements.

[`table-column`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#table-column)

These elements behave like [`<col>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/col) HTML elements.

[`table-caption`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#table-caption)

These elements behave like [`<caption>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/caption) HTML elements.

[`ruby-base`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#ruby-base)

These elements behave like [`<rb>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/rb) HTML elements.

[`ruby-text`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#ruby-text)

These elements behave like [`<rt>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/rt) HTML elements.

[`ruby-base-container`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#ruby-base-container)

These elements are generated as anonymous boxes.

[`ruby-text-container`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#ruby-text-container)

These elements behave like [`<rtc>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/rtc) HTML elements.

### [Box](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#box)

[`<display-box>`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/display-box)

These values define whether an element generates display boxes at all.

[`contents`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#contents)

These elements don't produce a specific box by themselves. They are replaced by their pseudo-box and their child boxes. Please note that the CSS Display Level 3 spec defines how the `contents` value should affect "unusual elements" — elements that aren't rendered purely by CSS box concepts such as replaced elements. See [Appendix B: Effects of display: contents on Unusual Elements](https://drafts.csswg.org/css-display/#unbox "External link (opens in new tab)") for more details.

[`none`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#none)

Turns off the display of an element so that it has no effect on layout (the document is rendered as though the element did not exist). All descendant elements also have their display turned off. To have an element take up the space that it would normally take, but without actually rendering anything, use the [`visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/visibility) property instead.

### [Precomposed](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#precomposed)

[`<display-legacy>`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/display-legacy)

CSS 2 used a single-keyword, precomposed syntax for the `display` property, requiring separate keywords for block-level and inline-level variants of the same layout mode.

[`inline-block`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#inline-block)

The element generates a block box that will be flowed with surrounding content as if it were a single inline box (behaving much like a replaced element would).

It is equivalent to `inline flow-root`.

[`inline-table`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#inline-table)

The `inline-table` value does not have a direct mapping in HTML. It behaves like an HTML [`<table>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table) element, but as an inline box, rather than a block-level box. Inside the table box is a block-level context.

It is equivalent to `inline table`.

[`inline-flex`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#inline-flex)

The element behaves like an inline-level element and lays out its content according to the flexbox model.

It is equivalent to `inline flex`.

[`inline-grid`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#inline-grid)

The element behaves like an inline-level element and lays out its content according to the grid model.

It is equivalent to `inline grid`.

### [Which syntax should you use?](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#which_syntax_should_you_use)

The [CSS display module](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display) describes a multi-keyword syntax for values you can use with the `display` property to explicitly define **outer** and **inner** display. The single keyword values (precomposed `<display-legacy>` values) are supported for backward-compatibility.

For example, using two values you can specify an inline flex container as follows:

css

```
.container {
  display: inline flex;
}
```

This can also be specified using the legacy single value:

css

```
.container {
  display: inline-flex;
}
```

For more information on these changes, see the [Using the multi-keyword syntax with CSS display](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Multi-keyword_syntax) guide.

## [Description](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#description)

The individual pages for the different types of value that `display` can have set on it feature multiple examples of those values in action — see the [Syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#syntax) section. In addition, see the following material, which covers the various values of display in depth.

### [Multi-keyword values](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#multi-keyword_values)

*   [Using the multi-keyword syntax with CSS display](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Multi-keyword_syntax)

### [CSS Flow Layout (display: block, display: inline)](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#css_flow_layout_display_block_display_inline)

*   [Block and inline layout in normal flow](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Block_and_inline_layout)
*   [Flow layout and overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Flow_layout_and_overflow)
*   [Flow layout and writing modes](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Flow_layout_and_writing_modes)
*   [Introduction to formatting contexts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Formatting_contexts)
*   [In flow and out of flow](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/In_flow_and_out_of_flow)

### [display: flex](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#display_flex)

*   [Basic concepts of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts)
*   [Aligning items in a flex container](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Aligning_items)
*   [Controlling ratios of flex items along the main axis](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Controlling_flex_item_ratios)
*   [Mastering wrapping of flex items](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Wrapping_items)
*   [Ordering flex items](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Ordering_items)
*   [Relationship of flexbox to other layout methods](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Relationship_with_other_layout_methods)
*   [Typical use cases of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Use_cases)

### [display: grid](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#display_grid)

*   [Basic concepts of grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Basic_concepts)
*   [Relationship to other layout methods](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Relationship_with_other_layout_methods)
*   [Line-based placement](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Line-based_placement)
*   [Grid template areas](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Grid_template_areas)
*   [Layout using named grid lines](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Named_grid_lines)
*   [Auto-placement in grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Auto-placement)
*   [Aligning items in CSS grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Box_alignment)
*   [Grids, logical values and writing modes](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Logical_values_and_writing_modes)
*   [CSS grid layout and accessibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Accessibility)
*   [Realizing common layouts using grids](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Common_grid_layouts)

### [Animating display](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#animating_display)

[Supporting browsers](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#browser_compatibility) animate `display` with a [discrete animation type](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Animations/Animatable_properties#discrete). This generally means that the property will flip between two values 50% through animating between the two.

There is one exception, which is when animating to or from `display: none`. In this case, the browser will flip between the two values so that the animated content is shown for the entire animation duration. So for example:

*   When animating `display` from `none` to `block` (or another visible `display` value), the value will flip to `block` at `0%` of the animation duration so it is visible throughout.
*   When animating `display` from `block` (or another visible `display` value) to `none`, the value will flip to `none` at `100%` of the animation duration so it is visible throughout.

This behavior is useful for creating entry/exit animations where you want to for example remove a container from the DOM with `display: none`, but have it fade out with [`opacity`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/opacity) rather than disappearing immediately.

When animating `display` with [CSS animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Animations), you need to provide the starting `display` value in an explicit keyframe (for example using `0%` or `from`). See [Using CSS animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Animations/Using) for an example.

When animating `display` with [CSS transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Transitions), two additional features are needed:

*   [`@starting-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style) provides starting values for properties you want to transition from when the animated element is first shown. This is needed to avoid unexpected behavior. By default, CSS transitions are not triggered on an element's first style update or when the `display` type changes from `none` to another type.
*   [`transition-behavior: allow-discrete`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transition-behavior) needs to be set on the [`transition-property`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transition-property) declaration (or the [`transition`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transition) shorthand) to enable `display` transitions.

For examples of transitioning the `display` property, see the [`@starting-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style#examples) and [`transition-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transition-behavior#examples) pages.

## [Accessibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#accessibility)

### [display: none](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#display_none)

Using a `display` value of `none` on an element will remove it from the [accessibility tree](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility/What_is_accessibility#accessibility_apis). This will cause the element and all its descendant elements to no longer be announced by screen reading technology.

If you want to visually hide the element, a more accessible alternative is to use [a combination of properties](https://webaim.org/techniques/css/invisiblecontent/ "External link (opens in new tab)") to remove it visually from the screen but still make it available to assistive technology such as screen readers.

While `display: none` hides content from the accessibility tree, elements that are hidden but are referenced from visible elements' `aria-describedby` or `aria-labelledby` attributes are exposed to assistive technologies.

### [display: contents](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#display_contents)

Current implementations in some browsers will remove from the [accessibility tree](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility/What_is_accessibility#accessibility_apis) any element with a `display` value of `contents` (but descendants will remain). This will cause the element itself to no longer be announced by screen reading technology. This is incorrect behavior according to the [CSS specification](https://drafts.csswg.org/css-display/#valdef-display-contents "External link (opens in new tab)").

*   [More accessible markup with display: contents | Hidde de Vries](https://hidde.blog/more-accessible-markup-with-display-contents/ "External link (opens in new tab)")
*   [Display: Contents Is Not a CSS Reset | Adrian Roselli](https://adrianroselli.com/2018/05/display-contents-is-not-a-css-reset.html "External link (opens in new tab)")

### [Tables](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#tables)

In some browsers, changing the `display` value of a [`<table>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table) element to `block`, `grid`, or `flex` will alter its representation in the [accessibility tree](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility/What_is_accessibility#accessibility_apis). This will cause the table to no longer be announced properly by screen reading technology.

*   [Hidden content for better a11y | Go Make Things](https://gomakethings.com/hidden-content-for-better-a11y/ "External link (opens in new tab)")
*   [MDN Understanding WCAG, Guideline 1.3 explanations](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Perceivable#guideline_1.3_%e2%80%94_create_content_that_can_be_presented_in_different_ways)
*   [Understanding Success Criterion 1.3.1 | W3C Understanding WCAG 2.0](https://www.w3.org/TR/UNDERSTANDING-WCAG20/content-structure-separation-programmatic.html "External link (opens in new tab)")

## [Formal definition](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#formal_definition)

| Initial value | inline |
| --- | --- |
| Applies to | all elements |
| Inherited | no |
| Computed value | as the specified value, except for positioned and floating elements and the root element. In both cases the computed value may be a keyword other than the one specified. |
| Animation type | Discrete behavior except when animating to or from none is visible for the entire duration |

## [Formal syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#formal_syntax)

display =
  [\ <display-outside> [||](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#double_bar "Double bar: one or several of the entities must be present, in any order") <display-inside> [\]](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#brackets "Brackets: enclose several entities, combinators, and multipliers to transform them as a single component")         [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  <display-listitem>                                [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  <display-internal>                                [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  <display-box>                                     [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  <display-legacy>                                  [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  grid-lanes                                        [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  inline-grid-lanes                                 [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  <display-outside> [||](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#double_bar "Double bar: one or several of the entities must be present, in any order") [\ <display-inside> [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present") math [\]](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#brackets "Brackets: enclose several entities, combinators, and multipliers to transform them as a single component")

<display-outside> =
  block   [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  inline  [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  run-in

<display-inside> =
  flow       [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  flow-root  [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  table      [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  flex       [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  grid       [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  ruby

<display-listitem> =
  <display-outside>[?](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#question_mark "Question mark: the entity is optional")     [&&](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#double_ampersand "Double ampersand: all of the entities must be present, in any order")
  [\ flow [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present") flow-root [\]](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#brackets "Brackets: enclose several entities, combinators, and multipliers to transform them as a single component")[?](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#question_mark "Question mark: the entity is optional")  [&&](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#double_ampersand "Double ampersand: all of the entities must be present, in any order")
  list-item

<display-internal> =
  table-row-group      [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  table-header-group   [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  table-footer-group   [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  table-row            [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  table-cell           [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  table-column-group   [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  table-column         [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  table-caption        [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  ruby-base            [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  ruby-text            [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  ruby-base-container  [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  ruby-text-container

<display-box> =
  contents  [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  none

<display-legacy> =
  inline-block  [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  inline-table  [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  inline-flex   [|](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Values_and_units/Value_definition_syntax#single_bar "Single bar: exactly one of the entities must be present")
  inline-grid

## [Examples](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#examples)

### [display value comparison](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#display_value_comparison)

In this example we have two block-level container elements, each one with three inline children. Below that, we have a select menu that allows you to apply different `display` values to the containers, allowing you to compare and contrast how the different values affect the element's layout, and that of their children.

We have included [`padding`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/padding) and [`background-color`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/background-color) on the containers and their children, so that it is easier to see the effect the display values are having.

#### HTML

html

```
<article class="container">
  <span>First</span>
  <span>Second</span>
  <span>Third</span>
</article>

<article class="container">
  <span>First</span>
  <span>Second</span>
  <span>Third</span>
</article>

<div>
  <label for="display">Choose a display value:</label>
  <select id="display">
    <option selected>block</option>
    <option>block flow</option>
    <option>inline</option>
    <option>inline flow</option>
    <option>flow</option>
    <option>flow-root</option>
    <option>block flow-root</option>
    <option>table</option>
    <option>block table</option>
    <option>flex</option>
    <option>block flex</option>
    <option>grid</option>
    <option>block grid</option>
    <option>list-item</option>
    <option>block flow list-item</option>
    <option>inline flow list-item</option>
    <option>block flow-root list-item</option>
    <option>inline flow-root list-item</option>
    <option>contents</option>
    <option>none</option>
    <option>inline-block</option>
    <option>inline flow-root</option>
    <option>inline-table</option>
    <option>inline table</option>
    <option>inline-flex</option>
    <option>inline flex</option>
    <option>inline-grid</option>
    <option>inline grid</option>
  </select>
</div>
```

#### CSS

css

```
html {
  font-family: "Helvetica", "Arial", sans-serif;
  letter-spacing: 1px;
  padding-top: 10px;
}

article {
  background-color: red;
}

article span {
  background-color: black;
  color: white;
  margin: 1px;
}

article,
span {
  padding: 10px;
  border-radius: 7px;
}

article,
div {
  margin: 20px;
}
```

#### JavaScript

js

```
const articles = document.querySelectorAll(".container");
const select = document.querySelector("select");

function updateDisplay() {
  articles.forEach((article) => {
    article.style.display = select.value;
  });
}

select.addEventListener("change", updateDisplay);

updateDisplay();
```

#### Result

Note that some multi-keyword values are added for illustration which have the following equivalents:

*   `block` = `block flow`
*   `inline` = `inline flow`
*   `flow` = `block flow`
*   `flow-root` = `block flow-root`
*   `table` = `block table`
*   `flex` = `block flex`
*   `grid` = `block grid`
*   `list-item` = `block flow list-item`
*   `inline-block` = `inline flow-root`
*   `inline-table` = `inline table`
*   `inline-flex` = `inline flex`
*   `inline-grid` = `inline grid`

You can find more examples in the pages for each separate display type under [Grouped values](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#grouped_values).

## [Specifications](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#specifications)

| Specification |
| --- |
| CSS Display Module Level 3# the-display-properties |
| Scalable Vector Graphics (SVG) 2# VisibilityControl |

## [Browser compatibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#browser_compatibility)

## [See also](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#see_also)

*   [`visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/visibility), [`float`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/float), [`position`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position)
*   [`grid`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/grid), [`flex`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/flex)
*   [CSS ruby layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Ruby_layout) module
*   SVG [`display`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/display) attribute
*   [Block and inline layout in normal flow](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Block_and_inline_layout)
*   [Introduction to formatting contexts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Formatting_contexts)

## Help improve MDN

[Learn how to contribute](https://developer.mozilla.org/en-US/docs/MDN/Community/Getting_started)

This page was last modified on Apr 20, 2026 by [MDN contributors](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display/contributors.txt).
