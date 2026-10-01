using System;
using System.Windows.Input;
using DynamicLayerSample.Models;

namespace DynamicLayerSample.Controls
{
    public class SelectAlertCommand : ICommand
    {
        private Dockpane1ViewModel _viewModel;

        public SelectAlertCommand(Dockpane1ViewModel viewModel)
        {
            _viewModel = viewModel;
        }

        public event EventHandler CanExecuteChanged
        {
            add { CommandManager.RequerySuggested += value; }
            remove { CommandManager.RequerySuggested -= value; }
        }

        public bool CanExecute(object parameter)
        {
            return parameter is SpeedViolationAlert;
        }

        public void Execute(object parameter)
        {
            if (parameter is SpeedViolationAlert item)
            {
                _viewModel.SelectAlertItemOperation(item);
            }
        }
    }
}
