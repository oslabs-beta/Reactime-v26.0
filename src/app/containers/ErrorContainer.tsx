/* eslint-disable max-len */
import React, { useState, useEffect, useRef } from 'react';
import { launchContentScript } from '../slices/mainSlice';
import Loader from '../components/ErrorHandling/Loader';
import ErrorMsg from '../components/ErrorHandling/ErrorMsg';
import { useDispatch, useSelector } from 'react-redux';
import { MainState, RootState, ErrorContainerProps } from '../FrontendTypes';
import { current } from '@reduxjs/toolkit';
import { RefreshCw, Github, PlayCircle } from 'lucide-react';

/*
This is the loading screen that a user may get when first initalizing the application. This page checks:

  1. if the content script has been launched on the current tab
  2. if React Dev Tools has been installed
  3. if target tab contains a compatible React app
*/

function ErrorContainer(props: ErrorContainerProps): JSX.Element {
  const dispatch = useDispatch();
  const { tabs, currentTitle, currentTab }: MainState = useSelector(
    (state: RootState) => state.main,
  );
  const [loadingArray, setLoading] = useState([true, true, true]); // We create a local state "loadingArray" and set it to an array with three true elements. These will be used as hooks for error checking against a 'status' object that is declared later in a few lines. 'loadingArray' is used later in the return statement to display a spinning loader icon if it's true. If it's false, either a checkmark icon or an exclamation icon will be displayed to the user.
  const titleTracker = useRef(currentTitle); // useRef returns an object with a property 'initialValue' and a value of whatever was passed in. This allows us to reference a value that's not needed for rendering
  const timeout = useRef(null);
  const { port } = props;

  // function that launches the main app
  function launch(): void {
    dispatch(launchContentScript(tabs[currentTab]));
  }

  function reinitialize(): void {
    port.postMessage({
      action: 'reinitialize',
      tabId: currentTab,
    });
  }

  let status = {
    // We create a status object that we may use later if tabs[currentTab] exists
    contentScriptLaunched: false,
    reactDevToolsInstalled: false,
    targetPageisaReactApp: false,
  };

  if (tabs[currentTab]) {
    // If we do have a tabs[currentTab] object, we replace the status obj we declared above  with the properties of the tabs[currentTab].status
    Object.assign(status, tabs[currentTab].status);
  }

  // hook that sets timer while waiting for a snapshot from the background script, resets if the tab changes/reloads
  useEffect(() => {
    // We declare a function
    function setLoadingArray(i: number, value: boolean) {
      // 'setLoadingArray' checks an element in our 'loadingArray' local state and compares it with passed in boolean argument. If they don't match, we update our local state replacing the selected element with the boolean argument
      if (loadingArray[i] !== value) {
        // this conditional helps us avoid unecessary state changes if the element and the value are already the same
        const loadingArrayClone = [...loadingArray];
        loadingArrayClone[i] = value;
        setLoading(loadingArrayClone);
      }
    }

    if (titleTracker.current !== currentTitle) {
      // if the current tab changes/reloads, we reset loadingArray to it's default [true, true, true]
      titleTracker.current = currentTitle;
      setLoadingArray(0, true);
      setLoadingArray(1, true);
      setLoadingArray(2, true);

      if (timeout.current) {
        // if there is a current timeout set, we clear it
        clearTimeout(timeout.current);
        timeout.current = null;
      }
    }

    if (!status.contentScriptLaunched) {
      // if content script hasnt been launched/found, set a timer or immediately update 'loadingArray' state

      if (loadingArray[0] === true) {
        // if loadingArray[0] is true, then that means our timeout.current is still null so we now set it to a setTimeout function that will flip loadingArray[0] to false after 3 seconds
        timeout.current = setTimeout(() => {
          setLoadingArray(0, false);
        }, 3000); // increased from 1500
      }
    } else {
      setLoadingArray(0, false); // if status.contentScriptLaunched is true, that means timeout.current !== null. This means that useEffect was triggered previously.
    }

    // The next two if statements are written in a way to allow the checking of 'content script hook', 'reactDevTools check', and 'target page is a react app' to be run in chronological order.
    if (loadingArray[0] === false && status.contentScriptLaunched === true) {
      timeout.current = setTimeout(() => {
        setLoadingArray(1, false);
      }, 3000); // increased from 1500
      setLoadingArray(1, false);
    }
    if (loadingArray[1] === false && status.reactDevToolsInstalled === true) {
      setLoadingArray(2, false);
    }

    // Unload async function when Error Container is unmounted
    return () => {
      clearTimeout(timeout.current);
    };
  }, [status, currentTitle, timeout, loadingArray]); // within our dependency array, we're keeping track of if the status, currentTitle/tab, timeout, or loadingArray changes and we re-run the useEffect hook if they do

  return (
    <div className='error-container'>
      <img src='../assets/whiteBlackSquareLogo.png' alt='Reactime Logo' className='error-logo' />

      <div className='error-content'>
        <div className='error-alert'>
          <div className='error-title'>
            <RefreshCw size={20} />
            Welcome to Reactime
          </div>

          <p className='error-description'>
            To ensure Reactime works correctly with your React application, please either refresh
            your development page or click the launch button below. This allows Reactime to properly
            connect with your app and start monitoring state changes.
          </p>
          <p className='error-description'>
            Important: Reactime requires React Developer Tools to be installed. If you haven't
            already, please{' '}
            <a
              href='https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi?hl=en'
              target='_blank'
              rel='noopener noreferrer'
              className='devtools-link'
            >
              install React Developer Tools
            </a>{' '}
            first.
          </p>
        </div>

        <p className='error-note'>
          Note: Reactime only works with React applications and by default only launches on URLs
          starting with localhost.
        </p>

        <button type='button' className='launch-button' onClick={launch}>
          <PlayCircle size={20} />
          Launch Reactime
        </button>

        <a
          href='https://github.com/open-source-labs/reactime'
          target='_blank'
          rel='noopener noreferrer'
          className='github-link'
        >
          <Github size={18} />
          Visit Reactime Github for more information
        </a>
      </div>
    </div>
  );
}

export default ErrorContainer;
