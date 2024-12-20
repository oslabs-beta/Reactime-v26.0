import React from 'react';
import { MemoryRouter as Router } from 'react-router-dom';
import MainContainer from './containers/MainContainer';

/*
  'currentTab' is the current active tab within Google Chrome.
  This is used to decide what tab Reactime should be monitoring. This can be "locked" currentTabInApp is the current active tab within Reactime (Map, Performance, History, etc).
  This is used to determine the proper tutorial to render when How To button is pressed.
*/

function App(): JSX.Element {
  return (
    <Router>
      {/* we wrap our application with the <Router> tag so that all components that are nested will have the react-router context */}
      <MainContainer />
    </Router>
  );
}

export default App;
