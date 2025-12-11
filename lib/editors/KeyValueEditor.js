import $ from 'jquery';
import Handsontable from 'handsontable';
import { MULTIVALUED_DELIMITER, titleOverText } from '../utils/fields';
import { isEmptyUnitVal } from '../utils/general';

// Derived from: https://jsfiddle.net/handsoncode/f0b41jug/

/**
 * The cell type adds supports for displaing the label value except the key in the key-value
 * dropdown editor type.
 */
export default class KeyValueListEditor extends Handsontable.editors
  .HandsontableEditor {
  /**
   * Prepares the editor instance by setting up various options for Handsontable.
   *
   * It appears this instance hangs around for the life of the handsontable!
   * @param {number} row The row index of the cell being edited.
   * @param {number} col The column index of the cell being edited.
   * @param {string} prop The property name or column index of the cell being edited.
   * @param {HTMLElement} td The HTML element for the cell.
   * @param {any} value The value of the cell.
   * @param {object} cellProperties The properties of the cell.
   */

  prepare(row, col, prop, td, value, cellProperties) {
    super.prepare(row, col, prop, td, value, cellProperties);
    let self = this;
    this.MENU_HEIGHT = 200;

    function filter(event) {
      const text = event.srcElement.value.toLowerCase();// word typed so far.
      const hide = [];
      const show = [];
      self.htOptions.data.forEach((row, index) => {
        if (row.label.toLowerCase().includes(text))
          show.push(index);
        else
          hide.push(index);
      });
      self.hiddenRowsPlugin.showRows(show);
      self.hiddenRowsPlugin.hideRows(hide);
      self.dropdownHotInstance.render();
      // Dynamically adjust position of filtered menu table above input.
      if (self.menu_above) {
        $(self.filtered_table).css('top', (self.input_top - self.input_height - $(self.filtered_table).height() ) + 'px');
      }
    }

    // Setting for pulldown menu display

    // Adding dynamic filter. DOM element textarea.handsontableInput. This is
    // relative to event's TEXTAREA since there are other textareas around
    // Done as an onkeyup() since its reset each time user visits a table cell.
    this.TEXTAREA.onkeyup = filter;

    Object.assign(this.htOptions, {
      licenseKey: 'non-commercial-and-evaluation',
      data: this.cellProperties.source,
      dropdownMenu: false,
      colWidths: '250', 
      height: this.MENU_HEIGHT,
      columns: [{data: '_id'},{data: 'label'}],
      hiddenColumns: {columns: [0]},
      hiddenRows: {rows: []},
      /*
      renderer: function(instance, td, row, col, prop, value, cellProperties) {
        // This custom renderer controls the appearance of each item in the dropdown list
        //Handsontable.renderers.TextRenderer.apply(this, arguments);
        console.log(instance, td, row, col, prop, value)
        td.innerHTML = `<span>⭐ ${value}</span>`; // Add custom HTML, icons, etc.
      },
      */
      cells: function(row, col) {
        var cellProp = {};
        // cellProperties.prop = 12 (column), cellProperties.row = the row.
        cellProp.className = 'selectDepth_' + (cellProperties.source[row]?.depth || '0');
        return cellProp
      },
      beforeValueRender(value, { row, instance }) {
        if (instance) { // i.e. an instance that has data: 'label' above?
          const label = instance.getDataAtRowProp(row, 'label');
          return label;
        }
        return value;
      },
    });

    if (cellProperties.keyValueListCells) {
      this.htOptions.cells = cellProperties.keyValueListCells;
    }

  }

  // Done once each time user clicks on cell and menu is displayed. 
  focus() {

    super.focus();

    // Helpers for autocomplete .filter() show/hide of rows:
    this.dropdownHotInstance = this.hot.getActiveEditor().htEditor;
    this.hiddenRowsPlugin = this.dropdownHotInstance.getPlugin('hiddenRows');

    // This section is to fix a handsontable bug where autocomplete/ dropdown
    // menus don't display if at bottom of a menu.
    this.menu = this.TEXTAREA.nextElementSibling;
    this.input_top = $(this.TEXTAREA).offset().top;
    this.input_height = $(this.TEXTAREA).height();
    const dh_height = $('#data-harmonizer-grid').height();
    const dh_top = $('#data-harmonizer-grid').offset().top;
    // Flip menu to top of input area if it would otherwise extend below DH table area.
    this.menu_above = (dh_height + dh_top) < (this.input_top + this.MENU_HEIGHT);
    // Imposes table.htCoreposition: fixed in data-harmonizer.css :
    $(this.menu).toggleClass('menu-above', this.menu_above); 
    if (this.menu_above) {
      this.filtered_table = this.menu.querySelector('table.htCore');
      $(this.filtered_table)
        .css('position','fixed')
        .css('top', (this.input_top - this.input_height - $(this.filtered_table).height()) + 'px');
    }
  }

  /**
   * Sets the value of the editor after finding the label associated with the _id key.
   *
   * @param {any} value The value to be set in the editor.
   */
  setValue(value) {
    if (this.htEditor) {
      const _id = this.htEditor.getDataAtProp('_id');
      const index = _id.findIndex((id) => id === value);

      if (index !== -1) {
        value = this.htEditor.getDataAtRowProp(index, 'label');
      }
    }
    super.setValue(value);
  }

  /**
   * Gets the value from the editor, translating the label to its associated _id key.
   *
   * @returns {any} The translated value or the original value if translation is not needed.
   */
  getValue() {
    const value = super.getValue();
    if (this.htEditor) {
      const labels = this.htEditor.getDataAtProp('label');
      const row = labels.indexOf(value);
      if (row !== -1) {
        return this.htEditor.getDataAtRowProp(row, '_id');
      }
    }
    return value;
  }
}

/**
 * Custom validator function for the KeyValueListEditor to validate cell values.
 *
 * @param {any} value The value to validate.
 * @param {function} callback A callback function to execute with the result of validation.
 */
export const keyValueListValidator = function (value, callback) {
  // Used AFTER user makes selection in menu. However the DH "Validate" button
  // uses other validation.

  let valueToValidate = value;

  if (valueToValidate === null || valueToValidate === void 0) { // === void 0 ~= undefined
    valueToValidate = '';
  }

  if (this.allowEmpty && valueToValidate === '') {
    callback(true);
  } else {
    callback(this.source.find(({ _id }) => _id === value) ? true : false);
  }

};

/**
 * Custom renderer function for displaying translated labels in the cells of a Handsontable instance.
 *
 * @param {object} hot Instance of Handsontable.
 * @param {HTMLElement} TD The table cell to render.
 * @param {number} row The row index of the cell.
 * @param {number} col The column index of the cell.
 * @param {string} prop The property name or column index of the cell.
 * @param {any} value The value of the cell.
 * @param {object} cellProperties The properties of the cell.
 */
export const keyValueListRenderer = function (
  hot, TD, row, col, prop, value, cellProperties) {
  // Call the autocomplete renderer to ensure default styles and behavior are applied
  // RENDERER text that is shown is not validated directly.
  Handsontable.renderers
    .getRenderer('autocomplete')
    .apply(this, [hot, TD, row, col, prop, value, cellProperties]);

  const item = cellProperties.source.find(_x => _x._id === value);
  TD.innerHTML = `<div class="htAutocompleteArrow">▼</div>${item?.label || value || ''}`;

};

export const multiKeyValueListRenderer = function (hot, TD, row, col, prop, value, cellProperties) {
    // Call the autocomplete renderer to ensure default styles and behavior are applied
    Handsontable.renderers
      .getRenderer('autocomplete')
      .apply(this, [hot, TD, row, col, prop, value, cellProperties]);

    let label = '';
    // Since multiple values, we must compose the labels for the resulting display.
    if (!isEmptyUnitVal(value)) {
      label = value
      .split(MULTIVALUED_DELIMITER)
      .map((value_item) => {
        const choice = cellProperties.source.find(({ _id }) => _id === value_item);
        //if (!(choice))
        //  console.warn(`"${value_item}" is not in permissible_values for "${cellProperties.name}" slot.`);
        return choice ? choice.label : value_item;
      })
      .join(MULTIVALUED_DELIMITER);
    }

    // This directly sets what is displayed in the cell on render() 
    // Uses the label as the display value but keep the _id as the stored value
    TD.innerHTML = `<div class="htAutocompleteArrow">▼</div>${label}`;
    //}
  };

