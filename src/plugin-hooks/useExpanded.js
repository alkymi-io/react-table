import React from 'react'

import { expandRows } from '../utils'

import {
  useGetLatest,
  actions,
  useMountedLayoutEffect,
  makePropGetter,
  ensurePluginOrder,
} from '../publicUtils'

// Actions
actions.resetExpanded = 'resetExpanded'
actions.toggleRowExpanded = 'toggleRowExpanded'
actions.toggleAllRowsExpanded = 'toggleAllRowsExpanded'

export const useExpanded = hooks => {
  hooks.getToggleAllRowsExpandedProps = [defaultGetToggleAllRowsExpandedProps]
  hooks.getToggleRowExpandedProps = [defaultGetToggleRowExpandedProps]
  hooks.stateReducers.push(reducer)
  hooks.useInstance.push(useInstance)
  hooks.prepareRow.push(prepareRow)
}

useExpanded.pluginName = 'useExpanded'

const defaultGetToggleAllRowsExpandedProps = (props, { instance }) => [
  props,
  {
    onClick: e => {
      instance.toggleAllRowsExpanded()
    },
    style: {
      cursor: 'pointer',
    },
    title: 'Toggle All Rows Expanded',
  },
]

const defaultGetToggleRowExpandedProps = (props, { row }) => [
  props,
  {
    onClick: () => {
      row.toggleRowExpanded()
    },
    style: {
      cursor: 'pointer',
    },
    title: 'Toggle Row Expanded',
  },
]

// Reducer
function reducer(state, action, previousState, instance) {
  if (action.type === actions.init) {
    return {
      expanded: {},
      ...state,
    }
  }

  if (action.type === actions.resetExpanded) {
    return {
      ...state,
      expanded: instance.initialState.expanded || {},
    }
  }

  if (action.type === actions.toggleAllRowsExpanded) {
    const { value } = action
    const { isAllRowsExpanded, rowsById } = instance

    const expandAll = typeof value !== 'undefined' ? value : !isAllRowsExpanded

    const expanded = {}

    Object.keys(rowsById).forEach(rowId => {
      expanded[rowId] = expandAll
    })

    return {
      ...state,
      expanded,
    }
  }

  if (action.type === actions.toggleRowExpanded) {
    const { id, value: setExpanded } = action
    const isExpanded = state.expanded[id] === true
    const shouldExpand =
      typeof setExpanded !== 'undefined' ? setExpanded : !isExpanded

    if (shouldExpand !== isExpanded) {
      return {
        ...state,
        expanded: {
          ...state.expanded,
          [id]: shouldExpand,
        },
      }
    } else {
      return state
    }
  }
}

function useInstance(instance) {
  const {
    data,
    rows,
    rowsById,
    manualExpandedKey = 'expanded',
    paginateExpandedRows = true,
    expandSubRows = true,
    autoResetExpanded = true,
    expandRowsInitially = false,
    getHooks,
    plugins,
    state: { expanded },
    dispatch,
  } = instance

  ensurePluginOrder(
    plugins,
    ['useSortBy', 'useGroupBy', 'usePivotColumns', 'useGlobalFilter'],
    'useExpanded'
  )

  if (expandRowsInitially) {
    Object.keys(rowsById).forEach(id => {
      if (!(id in expanded)) {
        expanded[id] = true
      }
    })
  }

  const getAutoResetExpanded = useGetLatest(autoResetExpanded)

  let isAllRowsExpanded = Boolean(
    Object.keys(rowsById).length && Object.keys(expanded).length
  )

  if (isAllRowsExpanded) {
    if (Object.keys(rowsById).some(id => !expanded[id])) {
      isAllRowsExpanded = false
    }
  }

  // Bypass any effects from firing when this changes
  useMountedLayoutEffect(() => {
    if (getAutoResetExpanded()) {
      dispatch({ type: actions.resetExpanded })
    }
  }, [dispatch, data])

  const toggleRowExpanded = React.useCallback(
    (id, value) => {
      dispatch({ type: actions.toggleRowExpanded, id, value })
    },
    [dispatch]
  )

  const toggleAllRowsExpanded = React.useCallback(
    value => dispatch({ type: actions.toggleAllRowsExpanded, value }),
    [dispatch]
  )

  const expandedRows = React.useMemo(() => {
    if (paginateExpandedRows) {
      return expandRows(rows, { manualExpandedKey, expanded, expandSubRows })
    }

    return rows
  }, [paginateExpandedRows, rows, manualExpandedKey, expanded, expandSubRows])

  const expandedDepth = React.useMemo(() => findExpandedDepth(expanded), [
    expanded,
  ])

  const getInstance = useGetLatest(instance)

  const getToggleAllRowsExpandedProps = makePropGetter(
    getHooks().getToggleAllRowsExpandedProps,
    { instance: getInstance() }
  )

  Object.assign(instance, {
    preExpandedRows: rows,
    expandedRows,
    rows: expandedRows,
    expandedDepth,
    isAllRowsExpanded,
    toggleRowExpanded,
    toggleAllRowsExpanded,
    getToggleAllRowsExpandedProps,
  })
}

function prepareRow(row, { instance: { getHooks }, instance }) {
  row.toggleRowExpanded = set => instance.toggleRowExpanded(row.id, set)

  row.getToggleRowExpandedProps = makePropGetter(
    getHooks().getToggleRowExpandedProps,
    {
      instance,
      row,
    }
  )
}

function findExpandedDepth(expanded) {
  let maxDepth = 0

  Object.keys(expanded).forEach(id => {
    const splitId = id.split('.')
    maxDepth = Math.max(maxDepth, splitId.length)
  })

  return maxDepth
}
