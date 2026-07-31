import { configureStore } from "@reduxjs/toolkit";
// import { createSagaMiddleware } from "redux-saga";
import rootReducer from "../Redux/reducer/rootReducer";
import rootSaga from "../Redux/saga/rootSaga";
const createSagaMiddleware = require("redux-saga").default;

// Initialize saga middleware
const sagaMiddleware = createSagaMiddleware();

// Create the store
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => [
    ...getDefaultMiddleware({
      thunk: false,
      serializableCheck: false,
    }),
    sagaMiddleware,
  ],
});

// Run the root saga
sagaMiddleware.run(rootSaga);

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

export default store;
