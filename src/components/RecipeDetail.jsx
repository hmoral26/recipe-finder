

// Shows the full recipe (ingredients + instructions) after the user clicks a card.
// The full meal object is already loaded, so this component just displays it.

function RecipeDetail({ meal }) {
// if no recipe is selected, show nothing
  if (!meal) return null;

  // build a clean list of ingredients from the API fields
  // the API stores them as strIngredient1, strIngredient2, ...
  
  // empty array to hold the cleaned up ingredient strings
const ingredients = [];

// the API stores up to 20 ingredients as separate fields
// (strIngredient1, strIngredient2, ... and the same for measures)
for (let i = 1; i <= 20; i++) {
  // grab the ingredient name for this number
  const ingredient = meal[`strIngredient${i}`];
  // grab the matching amount
  const measure = meal[`strMeasure${i}`];
    // only add it if there is an actual ingredient name
    if (ingredient && ingredient.trim() !== "") {
      ingredients.push(`${measure} ${ingredient}`.trim());

    }

  }

  return (
    <section className="recipe-detail" id="recipe-detail">

      {/* recipe name */}
      <h2>{meal.strMeal}</h2>

      {/* recipe image */}
      <img src={meal.strMealThumb} alt={meal.strMeal} />

      {/* ingredient list */}
      <h3>Ingredients</h3>
      <ul>
        {/* make one list item for each ingredient */}
        {ingredients.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>

      {/* cooking instructions */}
      <h3>Instructions</h3>
      <p>{meal.strInstructions}</p>
    </section>

  );
}




export default RecipeDetail;