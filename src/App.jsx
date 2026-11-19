
// Main component for the Recipe Finder
// Holds all state, talks to the TheMealDB API, and decides what to show

import { useState, useEffect, useRef } from "react";
import "./App.css";
import PageHeader from "./components/PageHeader.jsx";
import SearchBox from "./components/SearchBox.jsx";
import RecipeCard from "./components/RecipeCard.jsx";
import RecipeDetail from "./components/RecipeDetail.jsx";
import Footer from "./components/Footer.jsx";

// helper: count how many real ingredients a meal has
// looks at strIngredient1 through strIngredient20 and skips empty ones
function countIngredients(meal) {
  let count = 0;
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    if (ing && ing.trim() !== "") count++;
  }
  return count;
}

// helper: turn an array of ingredients into a readable phrase
// example: ["chicken", "rice"] becomes "chicken and rice"
function formatIngredientList(list) {
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]}, ${list[1]} and ${list[2]}`;
}

function App() {

  // SECTION: state
  // text the user is currently typing
  const [searchText, setSearchText] = useState("");
  // the 1–3 ingredients we actually searched for
  const [ingredients, setIngredients] = useState([]);
  // increases every time the user clicks Search so the same text can be retried
  const [searchTrigger, setSearchTrigger] = useState(0);
  // recipes that passed the ingredient and 10-ingredient checks
  const [meals, setMeals] = useState([]);
  // the full recipe the user clicked
  const [selectedMeal, setSelectedMeal] = useState(null);
  // loading and error for the main search
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // message shown when the user types something invalid (no request is made)
  const [inputMessage, setInputMessage] = useState("");
  // warning shown when some recipes could not be loaded or results are limited
  const [warning, setWarning] = useState("");

  // used so we can scroll the detail area into view
  const detailRef = useRef(null);

  // SECTION: main search effect
  // useEffect runs after the search ingredients or searchTrigger changes
  // searchTrigger also lets the user search again with the same ingredients
  // when the user clicks Search, this useEffect runs, contacts TheMealDB API, filters the recipes, and updates what appears on the webpage
  // it is esponsible for starting and managing the entire recipe search process
  useEffect(() => { // if no ingredients, do not search
    if (ingredients.length === 0) return;

    // the same controller is passed to every fetch in this search
    // it lets React cancel an old search when the user starts another one
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setWarning("");
    setMeals([]);
    setSelectedMeal(null);
    setInputMessage("");

    // this function does the whole search + filter process
    async function loadAndFilter() { // async lets us  use await inside it (does not freeze the entire page while waiting)
      try {

        // 1. ask TheMealDB for meals that contain each ingredient
        // filter.php returns a short recipe list (including IDs), not full instructions
        const idSets = [];
        for (const ing of ingredients) {
          // make the ingredient safe to put inside the API URL
          const encoded = encodeURIComponent(ing.replace(/ /g, "_"));

          // filter.php searches for recipes using one ingredient at a time
          // for "chicken, rice", we make one request for chicken and one for rice
          // the API returns basic recipe info: ID, name, and image
          // it does not return the complete ingredients or cooking instructions
          const res = await fetch(
  `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encoded}`,
  { signal: controller.signal }
);
          if (!res.ok) throw new Error("search failed");
          const data = await res.json();

          // save just the IDs; a Set makes it easy to check if an ID is in the list
          // data.meals can be null when the API finds nothing
          const ids = new Set((data.meals || []).map((m) => m.idMeal));
          idSets.push(ids);
        }

        // 2. keep only the meal IDs that appeared in every ingredient list
        if (idSets.length === 0) {
          setMeals([]);
          return;
        }

        // start with the first ingredient's IDs, then remove any IDs
        // not found for the other ingredients (the shared matches)
        let commonIds = [...idSets[0]];
        for (let i = 1; i < idSets.length; i++) {
          commonIds = commonIds.filter((id) => idSets[i].has(id));
        }

        if (commonIds.length === 0) {
          setMeals([]);
          return;
        }

        // 3. only check the first 30 matches so we do not make too many requests
        const maxRecipes = 30;
        const idsToCheck = commonIds.slice(0, maxRecipes);
        // remember if there were more matches than we actually checked
        const isLimited = commonIds.length > maxRecipes;

        // 4. look up full details in batches of 4, then keep recipes with 10 or fewer ingredients
        // lookup.php gives the ingredients and instructions missing from filter.php
        let failedLookups = 0;
        let successfulLookups = 0;
        const qualifying = [];
        const batchSize = 4;

        for (let i = 0; i < idsToCheck.length; i += batchSize) {
          const batch = idsToCheck.slice(i, i + batchSize);
          // allSettled waits for the 4 requests, even if one of them fails
          // this lets us keep the successful recipes and count the failed ones
          const results = await Promise.allSettled( //if one recipe lookup fails, the others still finish and return outcomes independently
            //promise.all  fails if one request fails
            batch.map(async (id) => {

              // lookup.php uses a recipe ID to get the complete recipe information
              // this includes the ingredients, measurements, and cooking instructions
              // we need the full ingredient list to check if the recipe has 10 or fewer ingredients
              // we also save these details so clicking a recipe does not need another API request
              const res = await fetch(
                `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`,
                { signal: controller.signal }
              );
              if (!res.ok) throw new Error("Recipe lookup failed");
              const data = await res.json();
              // get the first meal, or null if the API returns no details
              return data.meals?.[0] || null;
            })
          );

          if (controller.signal.aborted) return; // cancels outdated searches so they do not overwrite the newer search results

          // each result is either fulfilled (worked) or rejected (failed)
          for (const result of results) {
            if (result.status === "rejected") {
              failedLookups++;
              console.error("Recipe lookup failed:", result.reason);
              continue;
            }
            const meal = result.value;
            if (!meal) continue; // API returned no recipe
            successfulLookups++;
            const count = countIngredients(meal);
            if (count <= 10) { // only keep recipes with 10 or fewer ingredients
              //  copy the recipe and add its count for the RecipeCard
              qualifying.push({ ...meal, ingredientCount: count });
            }
          }
        }

        if (controller.signal.aborted) return;

        // 5. save the good recipes, then decide whether to show a warning or error
        //catch errors and show a message if some recipes could not be loaded
        // a warning means the user may still see some results
        //qualify, only good meals, 
        setMeals(qualifying);

        if (qualifying.length > 0 && failedLookups > 0) {
          setWarning(
            isLimited
              ? "Some recipes could not be loaded. Showing results from the first 30 matching recipes."
              : "Some recipes could not be loaded. Results may be incomplete."
          );
        } else if (qualifying.length === 0 && failedLookups > 0) {
          setError(
            "Could not load recipe details. Results may be incomplete. Please try again."
          );
        } else if (qualifying.length === 0 && successfulLookups > 0 && isLimited) {
          setWarning(
            "No qualifying recipes were found among the first 30 checked. Try different ingredients."
          );
        } else if (isLimited && qualifying.length > 0) {
          setWarning(
            "Showing results from the first 30 matching recipes. More matches may exist."
          );
        }
      } catch (err) {
        // cancelled searches should not show a network error
        if (err.name === "AbortError") return;
        setError("Could not connect to the recipe service. Please try again.");
      } finally {
        // only the active search should turn off its loading message
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadAndFilter();

    // cleanup runs before the effect starts a new search or the component unmounts
    // aborting prevents old results from overwriting the newer search
    return () => controller.abort();
  }, [ingredients, searchTrigger]);

  // SECTION: scroll to the detail area when a recipe is selected
  // this effect runs when selectedMeal changes, not for every page update
  // responsible for automatically scrolling the webpage to the full recipe details when a user clicks a recipe card
  useEffect(() => { // scroll the detail area into view when a recipe is selected
    if (selectedMeal) {
      detailRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedMeal]);

  // SECTION: show the full recipe that was already loaded during the search
  // no extra network request is needed
  function loadDetails(id) {
    // find the clicked card's full recipe in the meals we already saved
    const meal = meals.find((item) => item.idMeal === id);
    setSelectedMeal(meal || null);
  }

  // SECTION: handlers for the search box
  // Remembers what the user types
  function handleSearchChange(event) {
    // remmebers what the user is typing 
    setSearchText(event.target.value);
  }
    // Enforces the 1–3 ingredient rule and starts the search
  function handleSearch() {
    setInputMessage("");
    const raw = searchText.trim();
    if (raw === "") {
      setInputMessage("Please enter at least one ingredient.");
      return;
    }

    // clean the input: split on commas, trim, lowercase, remove blanks and duplicates
    // when the user types "chicken, rice, onion", we want ["chicken", "rice", "onion"]
    const parts = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s !== "");
    // Set removes repeated ingredients, such as "rice, rice"
    const unique = [...new Set(parts)];

    // validate the input and show a message if it is invalid
    if (unique.length === 0) {
      setInputMessage("Please enter at least one ingredient.");
      return;
    }
    if (unique.length > 3) {
      setInputMessage("Please enter no more than 3 ingredients.");
      return;
    }

    // clear any previously selected recipe before the new search
    setSelectedMeal(null);

    // updating these values starts the search effect above
    setIngredients(unique);
    setSearchTrigger((n) => n + 1);
  }

  // SECTION: render
  const headingText = ingredients.length
    ? `Recipes with ${formatIngredientList(ingredients)}`
    : "";

  // only show the generic empty message when there is no error or more specific warning
  const showEmptyMessage =
    !loading &&
    ingredients.length > 0 &&
    meals.length === 0 &&
    !error &&
    !warning;

  return (
    <>
      <PageHeader />

      <main>
        {/* problem statement required by the assignment */}
        <section className="problem">
          <h2>Who this is for</h2>
          <p>
            Students who want to cook something using ingredients they already
            have.
          </p>
          <h2>The problem</h2>
          <p>
            They have a few ingredients at home but are not sure which recipes
            use all of them and stay simple.
          </p>
          <h2>Why it matters</h2>
          <p>
            Searching by up to three ingredients and showing only recipes with
            10 or fewer listed ingredients helps them find practical options.
          </p>
        </section>

        {/* short instructions so people know how the search works */}
        <section className="how-to-use">
          <h2>How to Use</h2>
          <p>
            Type 1 to 3 ingredients you already have, separated by commas (for
            example: chicken, rice, onion). We'll find recipes that use all of
            them and have 10 or fewer listed ingredients. Some recipes may need
            additional ingredients. Click a recipe to see the full ingredient
            list and cooking instructions.
          </p>
        </section>

        {/* App sends the input value and event handlers to the child component */}
        <SearchBox
          value={searchText}
          onChange={handleSearchChange}
          onSearch={handleSearch}
        />

        {inputMessage && <p className="status">{inputMessage}</p>}
        {warning && <p className="status">{warning}</p>}

        {loading && (
          <p className="status">
            Finding recipes with 10 or fewer ingredients...
          </p>
        )}

        {error && <p className="status error">{error}</p>}

        {showEmptyMessage && (
          <p className="status">
            No recipes with 10 or fewer ingredients were found among those
            checked. Try different ingredients.
          </p>
        )}

        {/* only display cards after loading finishes and results exist, display recipes */}
        {!loading && meals.length > 0 && (
          <section>
            <h2>{headingText}</h2>
            <div className="recipe-list">
              {/* map makes one RecipeCard for each saved recipe */}
              {meals.map((meal) => ( //Turns that data into visible RecipeCard components.
                <RecipeCard
                  key={meal.idMeal}
                  meal={meal}
                  onSelect={loadDetails}
                  ingredientCount={meal.ingredientCount}
                />
              ))}
            </div>
          </section>
        )}

        {/* RecipeDetail receives the selected recipe as a prop */}
        {/* detail area, the ref is used for scrolling */}
        <div ref={detailRef}>
          <RecipeDetail meal={selectedMeal} />
        </div>
      </main>

      <Footer />
    </>
  );
}

export default App;
