


// The search input
// Pressing Enter or clicking the button both trigger the search on the parent (App.jsx)
//the actual input field and Search button.

function SearchBox({ value, onChange, onSearch }) {

  // let the user press Enter instead of clicking the button
  function handleKeyDown(event) {
    if (event.key === "Enter") {
      onSearch();
    }
  }

  return (
    <div className="search-box">
      {/* text input, value and onChange come from the parent (app.jsx)*/}
      {/*When the user types, the input calls onChange, which updates the parent’s state*/}
      <input
        type="text"
        placeholder="Enter 1-3 ingredients (chicken, rice, onion)"
        value={value}

        onChange={onChange} 

        onKeyDown={handleKeyDown}
      />

      {/* search button */}
      <button onClick={onSearch}>Search</button>
    </div>
  );
}

export default SearchBox;