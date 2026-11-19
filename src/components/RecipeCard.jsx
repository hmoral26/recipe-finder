

// One card that shows a single recipe in the results list
// It is reused for every meal, each time with different props
// The button makes it clickable with both mouse and keyboard

function RecipeCard({ meal, onSelect, ingredientCount }) {
  return (
    <article className="recipe-card">
      {/* button wraps the whole card so the entire thing is clickable */}
      <button
        type="button"
        // send the clicked recipe's ID back to App.jsx
onClick={() => onSelect(meal.idMeal)}
        aria-label={`View recipe for ${meal.strMeal}`}
      >
        {/* recipe image from the API */}
        <img src={meal.strMealThumb} alt="" />


        {/* recipe name */}
        <h3>{meal.strMeal}</h3>

        {/* only show the count if we have one */}
        {ingredientCount && (
          <p className="ingredient-count">{ingredientCount} ingredients</p>
        )}
      </button>
    </article>
  );
}

export default RecipeCard;
